# Help center («Справка») Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** replace the five-tab «Информация» page with the owner-approved «Справка» (variant A+B): situation card, search, topics, step-by-step troubleshooting, documents.

**Architecture:** pure helpers in `src/utils/help/` (topics, situation, branches, search, document outline) carry all decisions and are unit-tested; thin components in `src/components/help/` and three pages render them. Data comes from existing endpoints (`/cabinet/info/*`, `/cabinet/subscription`, `/cabinet/subscription/devices`) plus the new `category` field from the bot (`remnawave-bedolaga-telegram-bot/docs/superpowers/plans/2026-11-05-faq-categories.md`).

**Tech Stack:** React 19, react-router 7, TanStack Query, i18next, Tailwind, DOMPurify, vitest + Testing Library (jsdom).

**Spec:** design canvas https://claude.ai/artifact/DkFjsKd4H2ffEMd5aeH3ua, page «Справка: A+B на живом FAQ» (boards AB-Home, AB-States, AB-Topic, AB-Search, AB-Doc; stickies with priorities).

## Global Constraints

- Page title and nav label (ru): «Справка» (`nav.info`, `help.title`); en: «Help».
- Topic keys and order of tiles: `trouble` (accent, hint «пошаговая проверка»), `connect`, `services`, `devices`, `whitelist`, `billing`; `support` is rendered inside the «Не нашли ответ?» block, never as a tile; `null`/unknown → tile `other` («Другое») only when non-empty.
- Situation card — at most one, priority: `expired` → `trafficOut` → `trafficLow` (limit > 0, used ≥ 80 % and < 100 %) → `slotsFull` → `expiring` (active, not trial, `days_left ≤ 3`) → `noDevices` (active, 0 devices) → `trial`. Nothing applies → no card.
- `trafficOut` = `is_limited` OR (limit > 0 AND used ≥ limit) — strip-whitelist mode keeps status `active`.
- FAQ ids wired to situations / popular list live in one constant (prod ids, missing ids silently dropped): popular `[9, 7, 13, 45, 56]`; `expired [56, 57]`, `trafficOut [49, 53]`, `trafficLow` primary `53` + `[49]`, `slotsFull [7, 47]`, `expiring [55]`, `noDevices [2, 3]`, `trial [24]`.
- An answer whose HTML has ≥ 2 `<h3>` renders as intro + branch chips (one branch visible); on a topic page the first question is opened by default when it has branches.
- Search: words → stems (`len > 5 ? word.slice(0, -2) : word`), all stems must occur in title + answer text + topic label; first stem highlighted; docs searched by section only while the query has ≥ 2 characters.
- Same-origin links inside answers navigate in-app (no new tab); external links keep `target=_blank`.
- Documents: offer / privacy / rules respect `/cabinet/info/visibility`; «Рекуррентные платежи» are not shown (owner: no recurring payments).
- Routes: `/info`, `/info/topic/:topic`, `/info/faq/:id`, `/info/doc/:doc` (`rules|privacy|offer`), `/info/loyalty`; existing `/info/:slug` (custom InfoPages) unchanged.
- No horizontal scroll at 320–414 px; touch targets ≥ 44 px; light theme works through existing tokens.
- Commits without AI attribution trailers. Push only over SSH (`origin` = SayonaraQ fork).

## Review Focus

- Subscription endpoints fail or user has no subscription → page still shows search/topics/docs, no card, no crash → test in Task 5 (`renders without subscription`).
- FAQ API returns pages without `category` (old bot build) → everything lands in «Другое», search and popular still work → test in Task 1.
- Search query of one character / only spaces → no doc fetches, no «ничего не нашли» → test in Task 2.
- A FAQ id from the constants is missing (rollback restored the old 26) → card shows the action button without dead links → test in Task 1.
- Document without headings (rules are plain text) → no empty «Содержание» block → test in Task 2.

---

### Task 1: Topics and situation helpers

**Files:** Create `src/utils/help/topics.ts`, `src/utils/help/situation.ts`; Test `src/utils/help/topics.test.ts`, `src/utils/help/situation.test.ts`

**Interfaces — Produces:**
- `type HelpTopicKey = 'trouble'|'connect'|'services'|'devices'|'whitelist'|'billing'|'other'`
- `HELP_TOPICS: readonly { key: HelpTopicKey; accent?: boolean }[]` (order above, `other` last)
- `groupFaqByTopic(pages: FaqPage[]): { topics: { key: HelpTopicKey; pages: FaqPage[] }[]; support: FaqPage[] }` — keeps API order, drops empty topics.
- `pickFaq(pages: FaqPage[], ids: readonly number[]): FaqPage[]` — in `ids` order, missing skipped.
- `HELP_POPULAR_FAQ_IDS`, `HELP_SITUATION_FAQ: Record<HelpSituationKind, { primary?: number; links: number[] }>`
- `type HelpSituationKind = 'expired'|'trafficOut'|'trafficLow'|'slotsFull'|'expiring'|'noDevices'|'trial'`
- `pickHelpSituation(sub: Subscription | null, devicesTotal: number | null): { kind: HelpSituationKind; daysLeft?: number; usedGb?: number; limitGb?: number; deviceLimit?: number } | null`

- [ ] Step 1: tests — grouping (`category` missing/unknown → `other`, `support` split out, empty topics dropped); `pickFaq([..], [9, 999, 7])` → ids `[9, 7]`; situation table: expired beats trafficOut; `is_limited` → trafficOut; used 9/10 → trafficLow, 10/10 → trafficOut, limit 0 → neither; devices 3/3 → slotsFull; active days_left 3 → expiring, 4 → null; trial active → trial (not expiring); devicesTotal 0 → noDevices; `null` sub → null; `status: 'disabled'` → null.
- [ ] Step 2: `npx vitest run src/utils/help` → FAIL. Step 3: implement. Step 4: PASS. Step 5: commit `feat(help): темы FAQ и карточка ситуации — логика`.

### Task 2: Branches, search, document outline

**Files:** Create `src/utils/help/faqBranches.ts`, `src/utils/help/search.ts`, `src/utils/help/docOutline.ts`; tests alongside.

**Interfaces — Produces:**
- `splitFaqBranches(html: string): { intro: string; branches: { title: string; html: string }[] } | null` (null when < 2 `<h3>`)
- `htmlToPlainText(html: string): string` (re-use `src/utils/htmlToText.ts` if it fits)
- `searchStems(query: string): string[]`; `highlight(text: string, stems: string[]): { text: string; mark: boolean }[]`
- `type HelpDocSection = { doc: 'rules'|'privacy'|'offer'; id: string; title: string; text: string }`
- `searchHelp(query: string, faq: FaqPage[], topicLabel: (p: FaqPage) => string, sections: HelpDocSection[]): { faq: HelpHit[]; docs: HelpHit[] }`, `HelpHit = { key: string; to: string; title: Segments; snippet: Segments; where: string }`
- `outlineDocument(html: string, doc): { html: string; sections: HelpDocSection[] }` — DOMParser, assigns `id="sec-N"` to h1–h3 after sanitizing, section text = text until next heading.

- [ ] Step 1: tests — FAQ #9-like HTML with 5 `<h3>` → 5 branches + intro; 1 `<h3>` → null; `searchStems('Оплата  банк')` → `['опла','банк']`; query «банк возврат» requires both; snippet window contains the match; `searchStems(' a ')` (1 char) → treated as empty by `searchHelp`; outline of `<h2>9. Возвраты</h2><p>9.1…</p>` → section id `sec-1`, text includes «9.1»; plain text without headings → `sections: []`.
- [ ] Steps 2–5 as above; commit `feat(help): ветки ответа, поиск и оглавление документа`.

### Task 3: API types and admin topic picker

**Files:** Modify `src/api/info.ts` (`FaqPage.category?: string | null`), `src/api/infoPages.ts` (`LegacyFaqPage.category?: string | null`, `updatePage` sends `category`), `src/components/admin/LegacyFaqList.tsx` (select «Тема»: «Без темы» + `HELP_TOPICS` minus `other` + `support`), locales `admin.infoPages.faq.topic` ru/en.
**Test:** extend `src/components/admin/legacyFaqList.test.tsx` if present, else new: choosing «Оплата и аккаунт» sends `category: 'billing'`.
- [ ] Steps 1–5; commit `feat(admin): тема вопроса в редакторе FAQ`.

### Task 4: Help components

**Files:** Create `src/components/help/SituationCard.tsx`, `TopicGrid.tsx`, `FaqItem.tsx` (accordion, branches, copy link `${origin}/info/faq/${id}`, «Не помогло? Создать заявку» → `/support`, in-app navigation for same-origin links), `SupportBlock.tsx` (create ticket button, Telegram line from `supportConfig`, `support` topic questions as expandable items), `DocumentList.tsx`, `HelpSearchResults.tsx`; `src/hooks/useInternalLinks.ts`.
**Copy (ru)** — exactly as on the canvas boards AB-Home / AB-States / AB-Topic; button for `trafficOut`/`trafficLow` secondary → `/subscriptions/{id}`; `slotsFull` → `/subscriptions/{id}#devices`; `noDevices` → `/connection?sub={id}`; expired/expiring/trial → `subscriptionCardCta`.
**Test:** `src/components/help/faqItem.test.tsx` — branch chips switch visible steps; copy button writes `/info/faq/9`.
- [ ] Steps 1–5; commit `feat(help): компоненты справки`.

### Task 5: Pages, routes, Support entry, nav label

**Files:** Rewrite `src/pages/Info.tsx` (home: header, SituationCard, search input + results, TopicGrid, popular, SupportBlock, DocumentList incl. loyalty row when tiers exist and custom InfoPages/tab replacements as rows); create `src/pages/HelpTopic.tsx` (`/info/topic/:topic`, `/info/faq/:id` → resolve topic, open + scroll), `src/pages/HelpDocument.tsx` (TOC, updated date, reading time `ceil(words/200)`, «Наверх» after 600 px scroll, hash `#sec-N` scroll), `src/pages/HelpLoyalty.tsx` (loyalty block moved from old Info); modify `src/App.tsx` routes, `src/pages/Support.tsx` (last row «Частые вопросы и документы» → `/info`), locales ru/en (`help.*`, `nav.info`).
**Tests:** update `src/pages/infoLanguageCache.test.tsx` (FAQ language switch on `/info/topic/other`, rules on `/info/doc/rules`); new `src/pages/helpHome.test.tsx` — limited subscription → «Трафик «Белых списков» закончился» card; no subscription → no card, topics visible; typing «трафик» lists matching FAQ.
- [ ] Steps 1–5; then `npx tsc --noEmit`, `npx biome lint src`, `npx vitest run src/utils/help src/components/help src/pages/helpHome.test.tsx src/pages/infoLanguageCache.test.tsx src/components/admin` → all PASS; commit `feat(help): страница «Справка» вместо «Информации»`.

### Task 6: Visual check

Playwright (WebKit + Chromium) against `vite` with mocked `/api/*` (`scratchpad/pw/help.mjs`): states — limited, low traffic, slots full, no subscription, topic `trouble` branch 2, search «банк», document offer; widths 414/390/360/320, dark + light; assert `document.documentElement.scrollWidth <= innerWidth` after `document.fonts.ready`; screenshots go to the owner as a gallery before any deploy.

### Rollout (after owner's «разрешаю»)

Bot first (category field + SQL categories), then cabinet: backup `/srv/cabinet` tarball, build, rsync, verify new bundle hash. Rollback = untar backup.
