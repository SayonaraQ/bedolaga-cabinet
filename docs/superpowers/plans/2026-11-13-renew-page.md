# Renew Page (variant C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/subscriptions/:id/renew` as one card (tariff, status, period tiles, receipt) with an inline top-up that saves the renewal first, plus an autopay note and a tariff-switch link.

**Architecture:** Pure helpers in `src/utils/renew/renewPlan.ts`; four small components in `src/components/subscription/renew/`; the payment-method chips extracted from `WalletCard` into `src/components/balance/PaymentChoice.tsx` and shared; `RenewSubscription.tsx` composes them and owns the renew mutation.

**Tech Stack:** React 19, TypeScript, TanStack Query, react-router, i18next, Tailwind, vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-11-13-renew-page-design.md`

## Global Constraints

- No bot/API changes. Use existing `subscriptionApi.renewSubscription(periodDays, subId, subscription.end_date)` (it sends `operation_id` + `expected_end_date`).
- New strings only under `subscription.renewPage.*`, present in `ru.json`, `en.json`, `zh.json`, `fa.json` (`src/locales/locales.test.ts` must pass).
- Money: `formatAmount(k / 100, k % 100 === 0 ? 0 : 2)` + NBSP + `currencySymbol` (same as `RenewalStatus.tsx`).
- Dates: `Intl.DateTimeFormat(uiLocale(), { day: 'numeric', month: 'long' })`, add `year: 'numeric'` when the year differs from now.
- Do not change the daily branch, the `needsTariff` redirect, the loading skeleton, or the «no options» text.
- `walletCard.test.tsx` must pass unchanged.
- Run only the test files named in each task (the full suite is too heavy for this machine); plus `npx tsc --noEmit -p .` and `npx biome check <changed files>` before each commit.

## Review Focus

- Renew returns 402 without `missing_amount` (older bot or concurrent-check branch): fall back to the client-side shortfall, still create the top-up.
- Shortfall below the method minimum: pay the minimum and show the minimum hint.
- Uncertain renew outcome (network error, 502/503/504, cancel) while paying: never create a top-up; show `subscription.purchaseOutcomeUnknown`.
- Two quick clicks on «Оплатить»: one renew request and one top-up.
- Subscription ended in the past but `status` still `active`: «Будет активна до» counts from now, not from the old end date.

---

### Task 1: Pure renewal helpers

**Files:**
- Create: `src/utils/renew/renewPlan.ts`
- Test: `src/utils/renew/renewPlan.test.ts`

**Interfaces:**
- Produces:
  - `sortRenewalOptions(options: RenewalOption[]): RenewalOption[]` — ascending `period_days`, new array.
  - `pickDefaultPeriod(options: RenewalOption[], autopayPeriodDays?: number | null): number | null` — highlighted → autopay period (if offered) → shortest; `null` for empty.
  - `periodSavingsKopeks(option: RenewalOption, options: RenewalOption[]): number` — base = shortest option with `price_kopeks > 0`; `max(0, round(base.price * option.days / base.days) − option.price)`; 0 for the base and when no base.
  - `periodLabel(days: number): { unit: 'months' | 'days'; count: number }` — months when `days % 30 === 0`.
  - `renewedEndDate(endDate: string, periodDays: number, now: Date): Date` — `max(endDate, now) + periodDays × 86 400 000 ms`.
  - `renewalShortfallKopeks(priceKopeks: number, balanceKopeks: number): number` — `ceil(max(0, price − balance) / 100) × 100`.
  - `renewTopUpAmount(shortfallKopeks: number, method: Pick<PaymentMethod, 'min_amount_kopeks' | 'max_amount_kopeks'>): { amountKopeks: number; raisedToMinimum: boolean } | null` — `null` when shortfall is 0 or the amount exceeds max.
  - `paymentOptionLabel(name: string): string` — strips leading chars that are not letters/digits (`/^[^\p{L}\p{N}]+/u`), trims.

- [ ] **Step 1: Write the failing tests** — one `it` per function, with these cases:
  - `sortRenewalOptions([90, 30, 60])` → days `[30, 60, 90]`, input array untouched.
  - `pickDefaultPeriod`: `[30, 180{is_highlighted}]`, autopay 30 → 180; `[30, 60, 90]`, autopay 60 → 60; autopay 45 (not offered) → 30; `[]` → `null`.
  - `periodSavingsKopeks` on 300/580/850 ₽ for 30/60/90: 0, 2000, 5000; when the 30-day option costs 0 and a 60-day costs 50000 the base is the 60-day → its saving 0; savings never negative (60 days at 70000 → 0).
  - `periodLabel(90)` → `{unit:'months',count:3}`; `periodLabel(7)` → `{unit:'days',count:7}`.
  - `renewedEndDate('2026-11-25T03:00:00Z', 30, new Date('2026-11-12T12:00:00Z'))` → `2026-12-25T03:00:00.000Z`; `renewedEndDate('2026-11-08T03:00:00Z', 30, now)` → `2026-12-12T12:00:00.000Z`.
  - `renewalShortfallKopeks(30000, 15000)` → 15000; `(30000, 29950)` → 100; `(30000, 40000)` → 0.
  - `renewTopUpAmount(15000, {min:10000,max:10000000})` → `{15000,false}`; `(5000, …)` → `{10000,true}`; `(0, …)` → `null`; `(20000000, …)` → `null`.
  - `paymentOptionLabel('🏦 СБП')` → `'СБП'`; `('Банковская карта')` unchanged; `('💳 Карта')` → `'Карта'`.

- [ ] **Step 2:** `npx vitest run src/utils/renew/renewPlan.test.ts` → FAIL (module not found).
- [ ] **Step 3:** Implement the functions above in `src/utils/renew/renewPlan.ts`.
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5: Commit** `feat(renew): pure helpers for the renewal page`.

### Task 2: Shared payment chooser

**Files:**
- Create: `src/components/balance/PaymentChoice.tsx`
- Modify: `src/components/balance/WalletCard.tsx` (replace the two inline button groups in `WalletTopUp` with `<PaymentChoice>`)
- Test: `src/components/balance/walletCard.test.tsx` (unchanged, must stay green)

**Interfaces:**
- Produces: `PaymentChoice({ methods, method, onMethodChange, selectedOptionId, onOptionChange, disabled }: { methods: PaymentMethod[]; method: PaymentMethod; onMethodChange: (id: string) => void; selectedOptionId: string | undefined; onOptionChange: (id: string) => void; disabled?: boolean })` — renders exactly the markup now in `WalletTopUp`: methods group only when `methods.length > 1`, options group only when `method.options?.length`, `sortOptionsWithSbpFirst`, `aria-pressed`, same aria-labels and classes. Also export `methodDisplayName(method: PaymentMethod, t: TFunction): string` (the current `methodName`).

- [ ] **Step 1:** Run `npx vitest run src/components/balance/walletCard.test.tsx` → PASS (baseline).
- [ ] **Step 2:** Extract the component, use it in `WalletTopUp`.
- [ ] **Step 3:** Same command → PASS, no test edits.
- [ ] **Step 4: Commit** `refactor(balance): share the payment method chooser`.

### Task 3: Renew page

**Files:**
- Create: `src/components/subscription/renew/RenewPeriodTiles.tsx`, `RenewSummary.tsx`, `RenewPayPanel.tsx`, `RenewAutopayNote.tsx`
- Modify: `src/pages/RenewSubscription.tsx`
- Modify: `src/locales/{ru,en,zh,fa}.json` (`subscription.renewPage`)
- Test: create `src/pages/renewPage.test.tsx`; update `src/components/subscription/bestValuePeriod.test.tsx`, `src/pages/purchaseUnknownOutcome.test.tsx`; must stay green: `src/pages/renewDailySubscription.test.tsx`, `src/pages/renewSubscriptionLegacy.test.tsx`, `src/locales/locales.test.ts`

**Interfaces:**
- Consumes: Task 1 helpers; `PaymentChoice`, `methodDisplayName` (Task 2); `useTopUpPayment`, `PaymentReadyPanel`, `pickAutopayOption` (`src/utils/balance/renewalPlan.ts`), `showsAutopayToggle`, `canOpenTariffSwitch`, `tariffSelectionPath`, `BestValueBadge`, `BEST_VALUE_BORDER`.
- Produces:
  - `RenewPeriodTiles({ options, selectedDays, onSelect, disabled })` — `role="radiogroup"` with `aria-label={t('subscription.renewPage.periodHeading')}`; each tile a `<button role="radio" aria-checked>`; highlighted tile has class `border-2` and border `BEST_VALUE_BORDER` plus `BestValueBadge`; selected+highlighted adds `boxShadow: inset 0 0 0 2px rgb(var(--color-accent-400))`; promo shows struck `original_price_kopeks` and chip `-{discount_percent}%`; otherwise saving line `−{amount}` (U+2212) when > 0. Columns: n=1→1, 2→2, 4→2, else 3.
  - `RenewSummary({ newEndDate, priceKopeks, balanceKopeks, shortfallKopeks })` — `<dl>` rows in the order of the spec.
  - `type RenewAttempt = { kind: 'renewed' } | { kind: 'insufficient'; missingKopeks: number | null } | { kind: 'stopped' }` (exported from `RenewPayPanel.tsx`).
  - `RenewPayPanel({ shortfallKopeks, saveRenewal }: { shortfallKopeks: number; saveRenewal: () => Promise<RenewAttempt> })` — loads `['payment-methods']` via `balanceApi.getPaymentMethods`; first available method; option defaults to `getPreferredOptionId(method.options)`; button text `renewPage.payVia` with `paymentOptionLabel(option.name)` (or `methodDisplayName` when no options); on click (guarded against double click with a ref, like `WalletTopUp`): `await saveRenewal()`; on `insufficient` → amount = `renewTopUpAmount(missingKopeks != null ? ceil to 100 : shortfallKopeks, method)`; `stars`/`antilopay`/`targetCurrency !== 'RUB'` → `navigate('/balance/top-up/{id}?amount={rubles}')`; else `pay(amount, option)`; show `PaymentReadyPanel` when `paymentUrl`; show `error` in a `role="alert"` block; `null` amount → `t('common.error')`.
  - `RenewAutopayNote({ subscription, options, balanceKopeks, subId, now })` — renders nothing when `!showsAutopayToggle(subscription)` or the subscription ended; texts per spec.
- Page behaviour (`RenewSubscription.tsx`): selected period initialised by `pickDefaultPeriod` once options arrive; renew mutation `onError` maps insufficient (402, `detail.code === 'insufficient_funds'`) to state + `invalidateQueries(['purchase-options', subId])` instead of an error string; 409 → error text + invalidate `['subscription', subId]` and `['renewal-options', subId]`; uncertain → `subscription.purchaseOutcomeUnknown`. Enough-state button `renewPage.renewFor` / `renewPage.renewFree`. `saveRenewal` = `mutateAsync` mapped to `RenewAttempt`.

**ru strings (`subscription.renewPage`)** — en/zh/fa translate the same keys:
`activeUntil` «Активна до {{date}}», `endedOn` «Закончилась {{date}}», `periodHeading` «На сколько продлить», `months` «{{count}} мес», `days` «{{count}} дн.», `newEndLabel` «Будет активна до», `chargeLabel` «Спишем с баланса», `balanceLabel` «На балансе», `shortfallLabel` «Не хватает», `renewFor` «Продлить за {{price}}», `renewFree` «Продлить бесплатно», `topUpHeading` «Доплатить {{amount}}», `payVia` «Оплатить {{amount}} через {{name}}», `payHint` «Деньги придут на баланс, и подписка сразу продлится», `minTopUpHint` «Минимальное пополнение — {{amount}}, остаток останется на балансе», `autopayOn` «Автопродление включено», `autopayCovered` «{{date}} спишем {{price}} с баланса — продлевать вручную не обязательно.», `autopayCoveredSoon` «Спишем {{price}} с баланса в ближайшее время.», `autopayIfEnough` «{{date}} спишем {{price}}, если они будут на балансе.», `autopayWhenEnough` «Спишем {{price}}, как только они будут на балансе.», `autopayOffHint` «Включите — и {{price}} будут списываться с баланса сами за {{count}} дн. до конца.», `changeTariffHint` «Больше устройств или премиум-серверы».

- [ ] **Step 1: Write failing tests in `src/pages/renewPage.test.tsx`** (mock `@/api/subscription`, `@/api/balance`, `react-i18next` via `ru.json` like `bestValuePeriod.test.tsx`; `vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-12T12:00:00Z'))`; subscription `{id: 42, tariff_name: 'Уверенный стандарт', end_date: '2026-11-25T03:00:00Z', status: 'active', autopay_enabled: true, autopay_days_before: 3, autopay_period_days: 30}`; options 30/60/90 = 30000/58000/85000; methods `[{id:'yookassa', name:'ЮKassa', min_amount_kopeks:10000, max_amount_kopeks:10000000, is_available:true, options:[{id:'card',name:'💳 Карта'},{id:'sbp',name:'🏦 СБП'}]}]`):
  - `selects a period on load` — balance 100000: radio «1 мес» `aria-checked=true`; button «Продлить за 300 ₽» present without any click.
  - `shows the new end date` — text matching `/25 декабря/` in the summary; after clicking «3 мес» `/23 февраля 2027/`.
  - `counts an ended subscription from today` — `end_date '2026-11-08T03:00:00Z', status 'expired', is_expired true` → `/Закончилась 8 ноября/` and `/12 декабря/`; no autopay note.
  - `shows savings of longer periods` — «−20 ₽» inside the «2 мес» tile, «−50 ₽» inside «3 мес», none inside «1 мес».
  - `no per-tile shortage text` — balance 15000: «Не хватает» appears exactly once (summary); `queryByText(/Недостаточно средств/)` is null.
  - `pays the shortfall after saving the renewal` — balance 15000; `renewSubscription` rejects with an AxiosError 402 `{detail:{code:'insufficient_funds', missing_amount:15000}}`; click «Оплатить 150 ₽ через СБП» → `renewSubscription` called once with `(30, 42, '2026-11-25T03:00:00Z')`, then `createTopUp` once with `(15000, 'yookassa', 'sbp')`; call order renew → top-up.
  - `falls back to the client shortfall when the bot omits missing_amount` — same with `detail:{code:'insufficient_funds'}` → `createTopUp(15000, …)`.
  - `raises the top-up to the method minimum` — balance 25000 (shortfall 50 ₽) → button «Оплатить 100 ₽ через СБП», minimum hint visible, `createTopUp(10000, 'yookassa', 'sbp')`.
  - `renews without paying when money arrived meanwhile` — renew resolves → `createTopUp` not called; route `/subscriptions/42` rendered.
  - `never pays after an uncertain renew` — renew rejects with `new AxiosError('Network Error')` → `createTopUp` not called; `subscription.purchaseOutcomeUnknown` text shown.
  - `sends one renew and one top-up on a double click` — two synchronous clicks → each mock called once.
  - `autopay note` — enough balance (100000): `/22 ноября спишем 300 ₽ с баланса/`; `autopay_enabled:false` → «Автопродление выключено» and link «Включить» with `href` `/subscriptions/42`.
  - `tariff switch link` — when `canOpenTariffSwitch` is true for the mock, link «Сменить тариф» points to `tariffSelectionPath(42)`.
- [ ] **Step 2:** `npx vitest run src/pages/renewPage.test.tsx` → FAIL.
- [ ] **Step 3:** Implement the components, the page and the locale keys.
- [ ] **Step 4: Update old guards without weakening them:** `bestValuePeriod.test.tsx` — find tiles via `getByRole('radio', { name: /^1 мес|^6 мес/ })` (or `closest('[role="radio"]')`), keep all four assertions (one badge on the highlighted tile, `border-2` on highlighted only and kept after selecting another, nothing highlighted without operator mark, `-25%` visible with the badge); `purchaseUnknownOutcome.test.tsx` — renew button name becomes the `renewPage.renewFor` key the mock returns; same assertions.
- [ ] **Step 5:** `npx vitest run src/pages/renewPage.test.tsx src/components/subscription/bestValuePeriod.test.tsx src/pages/purchaseUnknownOutcome.test.tsx src/pages/renewDailySubscription.test.tsx src/pages/renewSubscriptionLegacy.test.tsx src/components/balance/walletCard.test.tsx src/locales/locales.test.ts src/utils/renew/renewPlan.test.ts` → all PASS; `npx tsc --noEmit -p .` clean; `npx biome check` on changed files clean.
- [ ] **Step 6: Commit** `feat(renew): one-card renewal with inline top-up (variant C)`.
