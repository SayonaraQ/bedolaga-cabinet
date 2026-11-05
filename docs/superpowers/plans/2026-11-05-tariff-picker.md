# Витрина тарифов A+B — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** витрина тарифов кабинета — блок «Во всех тарифах» + аккордеон тарифов с преимуществами-значками, данные для этого из бота.

**Architecture:** бот получает три поля тарифа (миграция 0142), настройку `TARIFF_COMMON_FEATURES` и отдаёт их в `purchase-options`. Кабинет считает цены/«выгоднее всех» чистыми функциями (`src/utils/tariffCard.ts`) и рисует аккордеон в `TariffPickerGrid`, не трогая платёжную логику `tariffAction`.

**Tech Stack:** бот — Python 3.13, FastAPI, SQLAlchemy, Alembic, pytest (`.venv/bin/pytest`, `.venv/bin/ruff`); кабинет — React 19, TypeScript, Tailwind, i18next, vitest, biome.

**Spec:** `docs/superpowers/specs/2026-11-05-tariff-picker-design.md` (в репо кабинета). Ветки: бот `feat/tariff-card-fields`, кабинет `feat/tariff-picker-accordion`.

## Global Constraints

- Не менять `tariffAction` и то, какое действие/сумму вызывает кнопка; меняется только вид.
- `TariffPickerLite`, лендинг, подарки, Telegram-меню бота — не трогать.
- Цвета только токенами темы (`accent-*`, `urgent-400` — золото, `success-400` — зелёный, `dark-*`), карточки на `bento-card`: должна работать светлая тема.
- Значки — инлайн SVG/иконки из `@/components/icons`, не эмодзи.
- Копирайт ru (точно): «Во всех тарифах», «Чаще всего выбирают», «Текущий тариф», «Выделенная скорость», «до {{speed}} Мбит/с», «{{gb}} ГБ», «в месяц на белые списки» / «в неделю на белые списки» / «в день на белые списки» / «на белые списки», «можно до {{count}}», «Премиум-серверы», «{{price}} за устройство», «выгоднее всех», «в месяц», «за {{count}} дн.», «в день», «{{price}}/мес при оплате за {{count}} месяц|месяца|месяцев», заголовок «Выберите тариф».
- Новые ключи — во все четыре локали (`ru`, `en`, `fa`, `zh`): `locales.test.ts` сверяет наборы.
- Коммиты без `Co-Authored-By`.

## Review Focus

- Открыли нижний тариф, когда раскрыт верхний — верхний схлопывается, и страница не должна прыгнуть: заголовок нажатого остаётся под пальцем (тот же приём, что `FaqItem`: `scrollBy` c `behavior: 'instant'`). Тест в Task 4.
- Промо-скидка (промокод/группа): заголовок, цена в карточке, «/мес за 3 месяца» и «за устройство» считаются от цены со скидкой. Тесты в Task 3.
- Тариф без периодов (произвольные дни) и посуточный: ни падения, ни строки «за 3 месяца», ни участия в «выгоднее всех». Тесты в Task 3.
- Старый тариф без новых полей (архивные «База/Семейный архивный»): описание видно в раскрытой карточке. Тест в Task 4.
- 320 px: длинное название переносится, цена справа не уезжает за край, «до 500 Мбит/с» не рвётся (`whitespace-nowrap`). Визуальная проверка Claude после задач.

---

## Бот (`~/remnawave-bedolaga-telegram-bot`, ветка `feat/tariff-card-fields`)

### Task 1: поля тарифа + админка

**Files:**
- Create: `migrations/alembic/versions/0142_tariff_card_fields.py` (revision `'0142'`, down `'0141'`, стиль как у `0141_faq_page_category.py`; downgrade через `batch_alter_table`)
- Modify: `app/database/models.py` (класс `Tariff`, рядом с `is_highlighted`)
- Modify: `app/cabinet/schemas/tariffs.py` (detail-ответ, create-, update-запрос)
- Modify: `app/cabinet/routes/admin_tariffs.py` (detail ~257, create ~322, update ~386)
- Test: `tests/migrations/test_0142_tariff_card_fields.py`, `tests/cabinet/test_admin_tariff_card_fields.py`

**Interfaces:**
- Produces: `Tariff.tagline: str | None` (`String(160)`), `Tariff.speed_limit_mbps: int | None`, `Tariff.has_premium_servers: bool` (`server_default='false'`, `nullable=False`).
- Схемы: detail — `tagline: str | None = None`, `speed_limit_mbps: int | None = None`, `has_premium_servers: bool = False`; create — те же с `Field(max_length=160)` / `Field(ge=1, le=100000)`; update — все `| None = None`.

- [ ] **Step 1: тесты.** Миграция — по образцу `tests/migrations/test_0141_faq_category.py` (колонки появились, downgrade убирает). Админка — по образцу `tests/cabinet/test_admin_tariff_panel_tag.py`:
  - `test_create_tariff_saves_card_fields` — create с `tagline='Для всей семьи'`, `speed_limit_mbps=50`, `has_premium_servers=True` → detail отдаёт те же значения;
  - `test_update_tariff_null_clears_tagline_and_speed` — PUT `{"tagline": null, "speed_limit_mbps": null}` → оба `None`;
  - `test_update_tariff_without_card_fields_keeps_them` — PUT `{"name": "x"}` → поля прежние;
  - `test_update_tariff_blank_tagline_becomes_none` — `"   "` → `None`, а `"  Для семьи "` → `"Для семьи"`;
  - `test_speed_limit_validation` — `0` и `100001` → 422.
- [ ] **Step 2:** `.venv/bin/pytest tests/migrations/test_0142_tariff_card_fields.py tests/cabinet/test_admin_tariff_card_fields.py -q` → FAIL.
- [ ] **Step 3: реализация.** В update — `tagline` и `speed_limit_mbps` через `'<поле>' in request.model_fields_set` (как `highlight_period_days`): явный `null` очищает; `has_premium_servers` — `if not None`. `tagline` обрезать `strip()`, пустую → `None`.
- [ ] **Step 4:** те же тесты → PASS; `.venv/bin/pytest tests/cabinet -q -k "tariff"` → PASS; `.venv/bin/ruff check app tests migrations` и `.venv/bin/ruff format --check` по изменённым файлам → чисто.
- [ ] **Step 5: коммит** `feat(tariffs): строка «для кого», скорость и премиум у тарифа (миграция 0142)`.

### Task 2: purchase-options + общие преимущества

**Files:**
- Create: `app/utils/tariff_common_features.py`
- Modify: `app/config.py` (`TARIFF_COMMON_FEATURES: str = ''`, рядом с `MAX_DEVICES_LIMIT`), `app/services/system_settings_service.py` (`CATEGORY_KEY_OVERRIDES`: `'TARIFF_COMMON_FEATURES': 'SUBSCRIPTIONS_CORE'`; если у ключей есть описания/подсказки — добавить: «Пункты блока „Во всех тарифах“ в кабинете: по строке „значок: текст“, значки globe, youtube, infinity, plus, check»)
- Modify: `app/services/tariff_purchase_devices.py` (новая функция)
- Modify: `app/cabinet/routes/subscription_modules/purchase.py` (`_build_tariff_response` ~300, ответ `get_purchase_options` в тарифном режиме ~460)
- Test: `tests/test_tariff_common_features.py`, `tests/cabinet/test_purchase_options_card_fields.py` (образец — `tests/cabinet/test_recurrent_flags_in_purchase_options.py`)

**Interfaces:**
- Produces: `parse_tariff_common_features(raw: str | None) -> list[dict[str, str]]` — элементы `{'icon': str, 'text': str}`; `ALLOWED_ICONS = ('globe', 'youtube', 'infinity', 'plus', 'check')`.
- Produces: `effective_max_device_limit(tariff, device_price_kopeks: int) -> int | None` в `tariff_purchase_devices.py`.
- Produces (JSON): у тарифа `tagline`, `speed_limit_mbps`, `has_premium_servers`, `max_device_limit`; на верхнем уровне `common_features`.

- [ ] **Step 1: тесты парсера** (`tests/test_tariff_common_features.py`):
  - `"globe: Все локации\nyoutube: YouTube без рекламы"` → `[{'icon':'globe','text':'Все локации'},{'icon':'youtube','text':'YouTube без рекламы'}]`;
  - `"plus: Устройства; check: Поддержка"` → два пункта (разделитель `;`);
  - `"Просто текст"` → `[{'icon':'check','text':'Просто текст'}]`; `"rocket: Быстро"` (неизвестный значок) → `[{'icon':'check','text':'rocket: Быстро'}]`; `"GLOBE : Мир"` → `globe`;
  - пустые строки/`None`/`"  ;\n "` → `[]`; 10 пунктов → первые 8; текст 100 символов → первые 80 (`rstrip`).
- [ ] **Step 2: тесты ответа** (`tests/cabinet/test_purchase_options_card_fields.py`):
  - тариф с `tagline/speed_limit_mbps=500/has_premium_servers=True` → те же поля в `tariffs[i]`;
  - `effective_max_device_limit`: `max_device_limit=10, device_limit=3, price=15000` → `10`; `max_device_limit=None` при `MAX_DEVICES_LIMIT=10` → `10`; цена `0` → `None`; `device_limit=0` → `None`; `max_device_limit=3, device_limit=3` → `None`; `max_device_limit=500` → не больше `MAX_DEVICE_LIMIT`;
  - `settings.TARIFF_COMMON_FEATURES = 'globe: Все локации'` (monkeypatch) → `common_features == [{'icon':'globe','text':'Все локации'}]`; пустая настройка → `[]`.
- [ ] **Step 3:** `.venv/bin/pytest tests/test_tariff_common_features.py tests/cabinet/test_purchase_options_card_fields.py -q` → FAIL.
- [ ] **Step 4: реализация.** `max_device_limit` считать от того же `device_price`, что уходит в `device_price_kopeks` ответа; правило — как `configured_max`/`maximum` в `resolve_purchase_device_selection`, плюс `None`, если потолок ≤ `tariff.device_limit`.
- [ ] **Step 5:** тесты Step 3 → PASS; `.venv/bin/pytest tests/cabinet -q` → PASS (кроме заведомо падающих на `main` — сверить); ruff чисто.
- [ ] **Step 6: коммит** `feat(cabinet): поля карточки тарифа и «Во всех тарифах» в purchase-options`.

---

## Кабинет (`~/bedolaga-cabinet`, ветка `feat/tariff-picker-accordion`)

### Task 3: типы и расчёты карточки

**Files:**
- Modify: `src/types/index.ts` (`Tariff`: `tagline?: string | null; speed_limit_mbps?: number | null; has_premium_servers?: boolean; max_device_limit?: number | null;`; `TariffsPurchaseOptions`: `common_features?: TariffCommonFeature[]`; новый `export interface TariffCommonFeature { icon: 'globe' | 'youtube' | 'infinity' | 'plus' | 'check' | string; text: string }`)
- Create: `src/utils/tariffCard.ts`, `src/utils/tariffCard.test.ts`

**Interfaces:**
- Consumes: `ApplyPromoDiscount`, `PromoDiscountResult` (`src/hooks/usePromoDiscount.ts`), `dailyPriceQuote` (`components/subscription/purchase/dailyPrice.ts`).
- Produces:
  - `type HeadlinePrice = { kind: 'month'; quote: PromoDiscountResult } | { kind: 'period'; days: number; quote: PromoDiscountResult } | { kind: 'daily'; quote: PromoDiscountResult } | { kind: 'flexible' }`
  - `tariffHeadlinePrice(tariff: Tariff, apply: ApplyPromoDiscount): HeadlinePrice` — порядок: `dailyPriceQuote` не `null` → `daily`; период `days === 30` → `month`; иначе первый период → `period`; нет периодов → `flexible`. Quote — `apply(period.price_kopeks, period.original_price_kopeks)` (как сейчас в гриде).
  - `longPeriodMonthly(tariff: Tariff, apply: ApplyPromoDiscount): { months: number; perMonthKopeks: number } | null` — только при `kind === 'month'`; самый длинный период с `months >= 2`; `perMonthKopeks = Math.round(quote.price / months / 100) * 100`; `null`, если не меньше месячной цены.
  - `bestPerDeviceTariff(tariffs: Tariff[], apply: ApplyPromoDiscount): { tariffId: number; perDeviceKopeks: number } | null` — кандидаты: `kind === 'month'`, цена > 0, `(base_device_limit ?? device_limit) > 0`; ≥ 2 кандидата и единственный минимум; `perDeviceKopeks = Math.round(price / limit)`.
  - `initialOpenTariffId(tariffs: Tariff[], currentTariffId: number | null | undefined): number | null` — текущий (`is_current` или `id === currentTariffId`) → выделенный → первый → `null`.
  - `trafficPeriod(mode: string | null | undefined): 'month' | 'week' | 'day' | 'none'` — `MONTH`/`MONTH_ROLLING` → month, `WEEK` → week, `DAY` → day, иначе none.
  - `canBuyMoreDevices(tariff: Tariff): number | null` — `max_device_limit`, если он > `device_limit` и `device_limit > 0`, иначе `null`.

- [ ] **Step 1: тесты** `src/utils/tariffCard.test.ts` на реальных ценах (копейки): Базовый `{30:20000,60:38000,90:55000}`, лимит 1; Стандарт `{30:30000,60:58000,90:85000}`, 3; Семейный `{30:75000,60:148000,90:215000}`, 7; Роскошный `{30:60000,60:118000,90:175000}`, 3. `apply` в тестах — тождественный (`price => ({price, original: undefined, percent: null, isPromoGroup:false})` по форме `PromoDiscountResult`) и скидочный (−10 %).
  - `longPeriodMonthly(Стандарт)` → `{months: 3, perMonthKopeks: 28300}`; Базовый → `18300`; Семейный → `71700`; Роскошный → `58300`; со скидкой −10 % у Стандарта → от 76500 → `25500`;
  - тариф только с `{30: …}` → `null`; периоды `{30:30000, 90:90000}` (не дешевле) → `null`; посуточный и без периодов → `null`;
  - `bestPerDeviceTariff([Базовый, Стандарт, Семейный, Роскошный])` → `{tariffId: Стандарт.id, perDeviceKopeks: 10000}`; только один тариф → `null`; два с равной ценой за устройство → `null`; посуточный не участвует;
  - `tariffHeadlinePrice`: `{7: 9000}` → `{kind:'period', days:7}`; без периодов → `flexible`; с `daily_price_kopeks > 0` → `daily`;
  - `initialOpenTariffId`: текущий важнее выделенного; без обоих — первый; пустой список → `null`;
  - `trafficPeriod(undefined)` → `none`, `'MONTH_ROLLING'` → `month`;
  - `canBuyMoreDevices({device_limit:3, max_device_limit:10})` → `10`; `max_device_limit: null` → `null`; `{device_limit:0, max_device_limit:10}` → `null`.
- [ ] **Step 2:** `npx vitest run src/utils/tariffCard.test.ts` → FAIL.
- [ ] **Step 3:** реализация в `src/utils/tariffCard.ts`.
- [ ] **Step 4:** тест → PASS; `npx tsc --noEmit` → чисто.
- [ ] **Step 5: коммит** `feat(tariffs): расчёты карточки тарифа — цена в месяц, за 3 месяца, выгоднее всех`.

### Task 4: аккордеон и «Во всех тарифах»

**Files:**
- Create: `src/components/subscription/purchase/TariffCommonFeatures.tsx`, `src/components/subscription/purchase/TariffAccordionCard.tsx`
- Modify: `src/components/subscription/purchase/TariffPickerGrid.tsx` (вместо карточек — аккордеон; баннер промогруппы и «все тарифы подключены» — как есть)
- Modify: `src/pages/SubscriptionPurchase.tsx` (финальная ветка заголовка: в тарифном режиме `t('subscription.chooseTariff')` = «Выберите тариф», в классическом — прежний `getSubscription`)
- Modify: `src/locales/{ru,en,fa,zh}.json` — ключи под `subscription.tariffCard.*` + `subscription.chooseTariff`
- Test: `src/components/subscription/purchase/tariffAccordion.test.tsx` (через `src/components/subscription/tariffGridHarness.tsx`); поправить `tariffTrafficLocale.test.tsx`, `tariffGridLegacy.test.tsx`, `bestValuePeriod.test.tsx`, если они проверяли старые чипы (сохранить смысл проверки на новой разметке, проверки действий кнопок не ослаблять)

**Interfaces:**
- Consumes: всё из Task 3; `tariffAction` и `TARIFF_ACTION_LABEL` (как сейчас).
- Produces: `TariffCommonFeatures({ features }: { features: TariffCommonFeature[] })` — `null` при пустом; `TariffAccordionCard(props: { tariff: Tariff; open: boolean; onToggle: () => void; isCurrent: boolean; isBestPerDevice: { perDeviceKopeks: number } | null; action: TariffActionKind; switchSelection: boolean; onSelect: () => void; onSwitch: () => void })`.

Разметка (по макету `Hybrid.dc.html`):
- `TariffCommonFeatures`: `<section aria-labelledby>`; заголовок «Во всех тарифах» (мелкий, uppercase, `text-dark-400`); `<ul>` сеткой `grid-cols-2`, пункт = плитка 32×32 `rounded-[10px]` с иконкой цвета accent + текст 14px. Иконки: globe, youtube (скруглённый прямоугольник с треугольником), infinity, plus (экран + «+»), check; неизвестная → check.
- Карточка: `<article>`; свёрнута — `bento-card` с обычной рамкой, раскрыта — `border-2 border-accent-500`. Шапка — `<button type="button" aria-expanded aria-controls>`: слева (плашка) + название `text-[19px] font-extrabold` + `tagline` `text-sm`; справа цена `font-display`/Outfit ~21px + подпись (`в месяц` / `за N дн.` / `в день` / «Гибкая оплата» без цены); шеврон, при раскрытии повёрнут на 180°. Плашки: текущий → «Текущий тариф» (`badge-success`); иначе выделенный → «★ Чаще всего выбирают» (`text-urgent-400 bg-urgent-400/15`, без золотой рамки).
- Тело (`id` = `aria-controls`, рендерится только раскрытым): разделитель, `<ul>` преимуществ 14.5px, пункт = плитка 34×34 + текст:
  - устройства: `<b>{t('subscription.devices', {count: device_limit})}</b>` + `· можно до N` (`canBuyMoreDevices`, кусок `whitespace-nowrap`); `device_limit === 0` → `<b>∞</b>` без хвоста;
  - скорость (если `speed_limit_mbps`): `<b>Выделенная скорость</b> <span class="whitespace-nowrap">до 500 Мбит/с</span>`;
  - трафик (если `traffic_limit_gb > 0`): `<b>70 ГБ</b> в месяц на белые списки` по `trafficPeriod`;
  - премиум (если `has_premium_servers`): плитка `bg-urgent-400/15 border border-urgent-400/35`, корона `text-urgent-400`, текст `<b class="text-urgent-400">Премиум-серверы</b>`;
  - «выгоднее всех» (если передан): плитка `bg-success-400/10`, ярлык `text-success-400`, `<b>100 ₽ за устройство</b> · выгоднее всех`;
  - если `!tagline && description` — `description` `whitespace-pre-line text-sm text-dark-400` после списка;
  - разделитель; цена крупно (~32px) + «в месяц»; при скидке — зачёркнутая и `-N%` как в нынешнем гриде; строка `longPeriodMonthly` `text-success-400`;
  - кнопка: `current-daily` → прежний текст без кнопки; `switch` → `onSwitch`, подпись как сейчас (`switchSelection`); иначе `onSelect`, `TARIFF_ACTION_LABEL[action]`; все кнопки `btn-primary w-full`.
- Цена: `formatPrice(k)` — 0 копеек и рубли → без дробной части («300 ₽»), иначе как сейчас (`formatAmount(k/100)` + символ). Валюта не рубли → всегда с дробной частью.
- Гриду: состояние `openId` (`useState(() => initialOpenTariffId(visible, subscription?.tariff_id))`; если `openId` пропал из списка — пересчитать). `onToggle` = `setOpenId(open ? null : id)`. Сортировка/фильтрация — как сейчас. Список — `flex flex-col gap-3` (не двухколоночная сетка: аккордеон).
- Прыжок: в `TariffAccordionCard` запомнить `getBoundingClientRect().top` шапки перед `onToggle`, в `useLayoutEffect` по `open` — `window.scrollBy({ top: delta, behavior: 'instant' })`, как в `src/components/help/FaqItem.tsx`.

- [ ] **Step 1: тесты** `tariffAccordion.test.tsx` (4 тарифа как в Task 3, «Стандарт» `is_highlighted`, `common_features` из спеки):
  - `opens highlighted tariff by default` — у «Уверенный стандарт» `aria-expanded="true"`, у остальных `false`; видна кнопка «Выбрать»/текущая подпись действия только одна;
  - `opens current tariff instead of highlighted` — `subscription.tariff_id` = Семейный → раскрыт Семейный, у него «Текущий тариф», нет «Чаще всего выбирают»;
  - `only one open; tapping open closes it` — клик по «Роскошный максимум» раскрывает его и сворачивает «Стандарт»; второй клик — все свёрнуты;
  - `premium row is gold, speed is dedicated` — у Роскошного текст «Премиум-серверы», «Выделенная скорость», «до 500 Мбит/с» в одном элементе с `whitespace-nowrap`; «можно до 10»;
  - `best per device only on Standard` — «100 ₽ за устройство» и «выгоднее всех» есть у Стандарта, нет у Базового (раскрыть его);
  - `price per month and 3-month line` — «300 ₽», «в месяц», «283 ₽/мес при оплате за 3 месяца»;
  - `common features block` — заголовок «Во всех тарифах» и 4 пункта; при `common_features: []` блока нет;
  - `legacy tariff shows description` — тариф без `tagline` с `description: 'Старое описание'` → после раскрытия текст виден; у тарифа с `tagline` описание не показывается;
  - `keeps header under finger` — раскрыт верхний; мок `getBoundingClientRect` у шапки нижнего (до: 600, после: 300) → `window.scrollBy` вызван с `{ top: -300, behavior: 'instant' }`;
  - `actions unchanged` — для подписки с текущим тарифом кнопка у другого тарифа зовёт `onSwitchTariff(id)`, у текущего — `onSelectTariff` с подписью «Продлить» (как в `tariffGridLegacy.test.tsx`).
- [ ] **Step 2:** `npx vitest run src/components/subscription/purchase/tariffAccordion.test.tsx` → FAIL.
- [ ] **Step 3:** реализация + локали (en: «In every plan», «Most popular», «Dedicated speed», «up to {{speed}} Mbps», «{{gb}} GB», «per month for whitelists», «Premium servers», «{{price}} per device», «best value», «per month», «Choose a plan», «{{price}}/mo when paying for {{count}} months»; fa/zh — перевод).
- [ ] **Step 4:** `npx vitest run src/components/subscription src/locales src/pages` → PASS; `npx tsc --noEmit`; `npx biome check src` → без новых ошибок.
- [ ] **Step 5: коммит** `feat(tariffs): витрина тарифов — аккордеон с преимуществами и «Во всех тарифах»`.

### Task 5: поля в админке тарифа

**Files:**
- Modify: `src/api/tariffs.ts` (типы detail/create/update: `tagline`, `speed_limit_mbps`, `has_premium_servers`)
- Modify: `src/pages/AdminTariffCreate.tsx` (рядом с описанием: поле «Строка под названием» (`maxLength 160`, подсказка «Для кого тариф: показывается в кабинете вместо описания»), число «Выделенная скорость, Мбит/с» (пусто = не показывать), переключатель «Премиум-серверы»; загрузка из detail и отправка — как `is_highlighted` ~146/182; пустые строка/скорость при редактировании отправлять явным `null`)
- Modify: локали (ключи `admin.tariffs.*`, 4 языка)
- Test: `src/pages/adminTariffCardFields.test.tsx` (образец — `adminTariffHighlightEdit.test.tsx`)

- [ ] **Step 1: тесты:** загрузка detail с полями → инпуты заполнены и переключатель включён; очистка строки и скорости → PUT с `tagline: null, speed_limit_mbps: null`; создание с полями → POST их несёт.
- [ ] **Step 2:** `npx vitest run src/pages/adminTariffCardFields.test.tsx` → FAIL.
- [ ] **Step 3:** реализация.
- [ ] **Step 4:** тест + `npx vitest run src/pages/adminTariff*` → PASS; `npx tsc --noEmit` чисто.
- [ ] **Step 5: коммит** `feat(admin): строка «для кого», скорость и премиум в форме тарифа`.

---

## После задач (Claude)

1. Ревью диффов обеих веток, прогон сторожей: бот `.venv/bin/pytest tests/cabinet tests/migrations tests/test_tariff_common_features.py -q`; кабинет `npx vitest run`, `npx tsc --noEmit`.
2. Визуальная проверка (WebKit + Chromium, 390/360/320, тёмная/светлая), моки как в `scratchpad/pw` прежних сессий.
3. Выкатка: бот (миграция 0142, образ с бэкапом и тегом отката) → кабинет (бэкап `/srv/cabinet`) → данные по разделу «Данные при выкатке» спеки → проверка `purchase-options` и живой страницы.
