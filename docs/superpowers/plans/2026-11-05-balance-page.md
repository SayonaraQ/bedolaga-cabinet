# Страница «Баланс», вариант C — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** баланс и пополнение — одна карточка со связью с продлением подписки; оплата открывается прямо со страницы.

**Architecture:** чистая логика (период и цена автопродления, состояние, быстрые суммы) — `src/utils/balance/renewalPlan.ts`; создание счёта вынесено из `TopUpAmount` в хук `useTopUpPayment` и панель `PaymentReadyPanel`; страница собирается из компонентов `src/components/balance/*`. Бот отдаёт `autopay_period_days`.

**Tech Stack:** React 18 + TS, @tanstack/react-query, react-i18next, vitest + Testing Library (jsdom), biome; бот — FastAPI/pydantic, pytest.

**Spec:** `docs/superpowers/specs/2026-11-05-balance-page-design.md`

**Исполнение:** задачи пишет Codex CLI (`codex exec`, sandbox `workspace-write`, `.git` у него только на чтение), ревью и коммиты — Claude.

## Global Constraints

- Тексты — ключи i18n в `src/locales/{ru,en,zh,fa}.json`, новые — под `balance.wallet.*`; склонения — i18next plural (`_one/_few/_many/_other` для ru, `_one/_other` для en).
- `TopUpAmount` и маршруты `/balance/top-up/*` ведут себя как раньше: `topUpAmountQr.test.tsx`, `topUpAmountToman.test.tsx` зелёные без правок ассертов.
- `balancePaymentRange.test.tsx`, `balancePromoSubscriptionRefresh.test.tsx` — зелёные (правка селекторов допустима, смысл — нет).
- Телефон 320–390 px без прокрутки вбок; тёмная и светлая темы — только классы темы (`dark-*`, `accent-*`, `success-*`, `warning-*`), без хардкода цветов.
- Новые компоненты — `src/components/balance/`; `Balance.tsx` только компонует.
- Суммы — копейки (`*_kopeks`) внутри, рубли — только на выводе; округление недостающей суммы — вверх до рубля.
- Проверки: `npx vitest run <файлы>`, `npx biome check <файлы>`, `npx tsc --noEmit -p tsconfig.json`.

## Review Focus

- Баланс с копейками и цена без остатка: `B=120.50 ₽, P=300 ₽` → «не хватает 180 ₽» (179.50 вверх), быстрые суммы 180/480/780 — тест в Task 2.
- Дата списания уже прошла (до конца ≤ `autopay_days_before`): текст без прошедшей даты — тест в Task 2.
- Быстрая сумма за пределами `min/max` способа (`P−B` = 5 ₽ при min 10 ₽): выпадает, а не ломает оплату — тест в Task 2.
- Двойное нажатие «Пополнить» — один счёт (кнопка `disabled` пока `isPending`) — тест в Task 4.
- Ошибка создания счёта показывается в карточке, карточка не теряет выбранную сумму — тест в Task 4.

---

### Task 1 (бот): `autopay_period_days` в ответе подписки

Репозиторий: `~/remnawave-bedolaga-telegram-bot`.

**Files:**
- Modify: `app/cabinet/schemas/subscription.py` (`SubscriptionResponse`, рядом с `autopay_days_before`)
- Modify: `app/cabinet/routes/subscription_modules/helpers.py` (`_subscription_to_response`)
- Test: `tests/cabinet/test_subscription_autopay_period.py` (по образцу `tests/cabinet/test_subscription_requires_tariff_flag.py`)

**Interfaces:**
- Produces: поле `autopay_period_days: int | None = None` в JSON подписки кабинета = `subscription.autopay_period_days` как есть.

- [ ] Тест `test_response_carries_autopay_period_days`: подписка с `autopay_period_days=60` → `response.autopay_period_days == 60`; без значения → `None`.
- [ ] Прогнать — FAIL. Добавить поле и передачу. Прогнать — PASS; `ruff check` по изменённым файлам.

### Task 2: логика `renewalPlan`

**Files:**
- Create: `src/utils/balance/renewalPlan.ts`
- Test: `src/utils/balance/renewalPlan.test.ts`
- Modify: `src/types/index.ts` — у подписки `autopay_period_days?: number | null`

**Interfaces:**
- Produces:
  - `pickAutopayOption(options: RenewalOption[], autopayPeriodDays?: number | null): RenewalOption | null` — опция с `period_days === autopayPeriodDays`, иначе с минимальным `period_days`; `null` при пустом списке или `price_kopeks <= 0`.
  - `type RenewalPlan = { kind: 'enough' | 'short' | 'expired'; tariffName: string | null; periodDays: number; priceKopeks: number; renewalsCovered: number; shortfallKopeks: number; autopayEnabled: boolean; endDate: Date; chargeDate: Date; chargeDatePassed: boolean; subscriptionId: number }`
  - `buildRenewalPlan(input: { subscription: Subscription | null; options: RenewalOption[] | undefined; balanceKopeks: number; now: Date }): RenewalPlan | null`
  - `type QuickTopUp = { amountKopeks: number; labelKey: 'shortfall' | 'months' | 'days' | 'plain'; count: number }`
  - `buildQuickTopUps(plan: RenewalPlan | null, method: Pick<PaymentMethod, 'min_amount_kopeks' | 'max_amount_kopeks' | 'quick_amounts'>): { items: QuickTopUp[]; defaultIndex: number }`

Правила (из спеки):
- `null`: нет подписки, `is_trial`, `is_daily`, нет опций/`pickAutopayOption` → `null`.
- `kind`: `is_expired` (или `status === 'expired'`) → `'expired'`; иначе `balance >= P` → `'enough'`, иначе `'short'`. Для `'expired'` `shortfallKopeks` тоже считается.
- `renewalsCovered = floor(B / P)`; `shortfallKopeks = max(0, ceilToRuble(P − B))`.
- `chargeDate = endDate − autopay_days_before` суток; `chargeDatePassed = chargeDate <= now`.
- Суммы: `plan` есть и `B ≥ P` → `[P, 2P, 3P]`, `labelKey` `'months'` с `count = k·periodDays/30`, если `periodDays % 30 === 0`, иначе `'days'` с `count = k·periodDays`; `defaultIndex = 1`. `B < P` (включая expired) → `[S, S+P, S+2P]` где `S = shortfallKopeks`; первая `'shortfall'` (`count 0`), дальше как выше с `k = 1, 2`; `defaultIndex = 0`. `plan = null` → `method.quick_amounts ?? [10000, 30000, 50000, 100000]`, `'plain'`, `defaultIndex = 1`. Всё вне `[min, max]` выпадает; `defaultIndex` указывает на существующий элемент (иначе 0; пусто — `-1`).

- [ ] Тесты (значения — точно эти): тариф «Уверенный стандарт», опции 30/60/90 = 30000/58000/85000.
  - `pickAutopayOption(opts)` → период 30; `pickAutopayOption(opts, 60)` → 60; `pickAutopayOption(opts, 45)` → 30; `pickAutopayOption([])` → `null`.
  - B=102904, активна, автопродление вкл., end 2026-11-28, before 3, now 2026-11-05 → `kind 'enough'`, `renewalsCovered 3`, `chargeDate` 2026-11-25, `chargeDatePassed false`.
  - B=12050 → `kind 'short'`, `shortfallKopeks 18000`; суммы 18000/48000/78000, `defaultIndex 0`.
  - now 2026-11-26 при end 2026-11-28 → `chargeDatePassed true`.
  - `is_expired` → `kind 'expired'`.
  - триал / `is_daily` / нет подписки / опции `[]` → `null`.
  - B=102904 → суммы 30000/60000/90000, `labelKey 'months'`, `count` 1/2/3, `defaultIndex 1`.
  - min 1000 и `S = 500` → первая сумма выпала, `defaultIndex 0` указывает на 30500.
  - `plan null`, `quick_amounts` нет → 10000/30000/50000/100000.
- [ ] FAIL → реализация → PASS, biome, tsc.

### Task 3: хук `useTopUpPayment` и `PaymentReadyPanel` из `TopUpAmount`

**Files:**
- Create: `src/hooks/useTopUpPayment.ts`, `src/components/balance/PaymentReadyPanel.tsx`
- Modify: `src/pages/TopUpAmount.tsx` — использует оба, поведение то же
- Test: `src/hooks/useTopUpPayment.test.tsx`; сторожа — `topUpAmountQr.test.tsx`, `topUpAmountToman.test.tsx`

**Interfaces:**
- Produces:
  - `useTopUpPayment(method: PaymentMethod | undefined): { pay: (amountKopeks: number, option?: string | null, extra?: { email?: string }) => void; isPending: boolean; error: string | null; setError: (e: string | null) => void; paymentUrl: string | null; qrPayload: string | null; reset: () => void }` — переносит из `TopUpAmount` `topUpMutation` целиком: `createTopUp`, `saveTopUpPendingInfo`, `qr_payload`, `open_url_direct` + `openPaymentUrl`, t.me/tg://, сообщения об ошибках (`balance.useBot`, локализованные), rate-limit (`checkRateLimit`/`RATE_LIMIT_KEYS.PAYMENT`, как сейчас в `handleSubmit`).
  - `PaymentReadyPanel({ paymentUrl, qrPayload }: { paymentUrl: string; qrPayload: string | null })` — нынешний блок «Оплата готова» (QR, «Открыть страницу оплаты», копирование).
- Stars-оплата (`starsPaymentMutation`), почта `antilopay`, валюта — остаются в `TopUpAmount`.

- [ ] Тест хука: `createTopUp` замокан → `pay(30000, 'sbp')` вызывает `createTopUp(30000, 'yookassa', 'sbp')` один раз; ответ с `payment_url` и `open_url_direct: false` → `paymentUrl` выставлен; ответ с `qr_payload` → `qrPayload`; ошибка API → `error` не пустой, `isPending` снова `false`.
- [ ] FAIL → вынести → PASS; сторожа `TopUpAmount` зелёные без правки ассертов; biome, tsc.

### Task 4: карточка «Баланс и пополнение»

**Files:**
- Create: `src/components/balance/WalletCard.tsx`, `src/components/balance/RenewalStatus.tsx`
- Modify: `src/locales/{ru,en,zh,fa}.json` (`balance.wallet.*`)
- Test: `src/components/balance/walletCard.test.tsx`

**Interfaces:**
- Consumes: `buildRenewalPlan`, `buildQuickTopUps` (Task 2); `useTopUpPayment`, `PaymentReadyPanel` (Task 3).
- Produces: `WalletCard({ balanceKopeks, subscription, renewalOptions, methods }: { balanceKopeks: number; subscription: Subscription | null; renewalOptions: RenewalOption[] | undefined; methods: PaymentMethod[] })`.

Поведение:
- Сумма «На балансе»; `RenewalStatus` по `plan` (таблица состояний спеки: тексты, «Включить» → `/subscriptions/{id}`, «Продлить за P» → `/subscriptions/{id}/renew`, если `B ≥ P` у expired).
- Ряд выбора способа — если способов > 1; ряд вариантов (`method.options`, «Карта / СБП», по умолчанию первый) — если у выбранного они есть.
- Быстрые суммы + «Другая сумма» (ввод снимает выбор, выбор очищает поле); кнопка «Пополнить на N ₽» `disabled` при пустой/вне-диапазона сумме и при `isPending`.
- Способ `stars`, `antilopay`, или валюта ≠ RUB → кнопка — ссылка на `/balance/top-up/{id}?amount={рубли}`; иначе `pay(amount, option)`.
- После `paymentUrl` — `PaymentReadyPanel` под кнопкой; ошибка — под кнопкой, выбор суммы сохраняется.
- Подпись «Оплата через {name} · от {min} до {max} ₽».

- [ ] Тесты: (1) хватает — видно «Хватит на 3 продления», «25 ноября», кнопка «Пополнить на 600 ₽»; (2) не хватает — «Не хватает 180 ₽», кнопка «Пополнить на 180 ₽»; (3) автопродление выкл. — ссылка «Включить» на `/subscriptions/42`; (4) expired и `B ≥ P` — ссылка «Продлить за 300 ₽» на `/subscriptions/42/renew`; (5) нет подписки — блока статуса нет, суммы 100/300/500/1000; (6) выбор «СБП» + «Пополнить» → `createTopUp(…, 'yookassa', 'sbp')` ровно один раз при двух кликах подряд; (7) ошибка API — текст ошибки виден, выбранная сумма осталась; (8) «Другая сумма» 250 → кнопка «Пополнить на 250 ₽».
- [ ] FAIL → реализация → PASS; biome, tsc; `locales.test.ts` зелёный.

### Task 5: промокод, последние операции, сборка страницы

**Files:**
- Create: `src/components/balance/PromoCodeRow.tsx` (форма из `Balance.tsx` как есть, в раскрывашке), `src/components/balance/RecentTransactions.tsx` (3 последние + «Вся история» раскрывает нынешний список с пагинацией)
- Modify: `src/pages/Balance.tsx` — порядок: заголовок → `WalletCard` → `PromoCodeRow` → `RecentTransactions` → сохранённые карты (как сейчас); запрос `['subscription']` (тот же, что на главной) и `['renewal-options', subscription.id]`; успешный промокод инвалидирует `['balance']`, `['subscription']`, `['renewal-options']`
- Modify: локали
- Test: `src/components/balance/promoCodeRow.test.tsx`, `src/components/balance/recentTransactions.test.tsx`; сторожа — `balancePaymentRange.test.tsx`, `balancePromoSubscriptionRefresh.test.tsx`

- [ ] Тесты: строка свёрнута, по нажатию видно поле и «Активировать» (`aria-expanded` меняется); 5 транзакций → видно 3, «Вся история» → все 5 и пагинация как была; нет транзакций → блока нет; минус — без `text-error-*`.
- [ ] FAIL → реализация → PASS; сторожа зелёные; biome, tsc; полный `npx vitest run src/components/balance src/pages/balance* src/pages/topUp* src/utils/balance src/hooks src/locales`.

### Task 6 (Claude): проверка и выкатка

- [ ] WebKit 390/320, тёмная/светлая: состояния «хватает», «не хватает», «нет подписки», раскрытый промокод, «Вся история»; без прокрутки вбок.
- [ ] Бот: мерж в `main` форка, выкатка (бэкап, `git pull`, сборка, рестарт контейнера — по runbook бота), проверка поля в ответе подписки.
- [ ] Кабинет: мерж в `main`, пуш, бэкап `/srv/cabinet`, сборка, rsync; проверка бандла; ручная проверка владельцем.
