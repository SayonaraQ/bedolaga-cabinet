# Null Core themes: Null Pulse base + seasonal appearance

Date: 2026-11-11. Owner-approved. Source documents (read them, they are authoritative for visuals):

- Owner decisions (overrides the plans where they differ): `/home/aster/infra-ansible/docs/2026-11-11-seasonal-theme-decisions.md`
- Seasonal plan (Codex, 10.11): `/home/aster/infra-ansible/docs/2026-11-10-seasonal-theme-implementation-plan.md`
- Null Pulse plan (07.11): `/home/aster/infra-ansible/docs/2026-11-07-null-core-design-implementation-plan.md`
- Reference mockup source (grounds, particles, decor SVG, decor positions, overlay CSS): `/home/aster/infra-ansible/docs/design/null-core-2026-11-11/seasons-mockup.src.html` — see the `OVERLAY`, `ground()`, `DECOR`, `snow()`, `snowman()`, `gardenBed()`, `gardenTulip()`, `gardenDaffodil()`, `beach()`, `shell()`, `palm()`, `wave()`, `mapleCluster()`, `mapleSingle()`, `leafRow()` parts. It renders the real cabinet DOM, so the CSS there targets real classes. Port the look, not the DOM hacks.
- Original art (Codex): `/home/aster/infra-ansible/docs/design/null-core-winter-2026-11-10/{winter.js,spring-v5-flowers.js,seasonal-decorations.js}`.

## 1. Appearance model

Two independent axes:

1. **Base theme** `dark | light` — unchanged (`cabinet-theme`, header moon/sun button, admin dark/light switches).
2. **Seasonal appearance** on/off — new per-device preference `cabinet-seasonal` = `'on' | 'off'` (via `safeLocal`). Absent ⇒ admin default `seasonalDefault`.

Admin flags come from `GET /cabinet/branding/themes` (bot adds them): `seasonal: boolean` (availability, default **false**) and `seasonalDefault: boolean` (default **true**). A response without these fields (old bot) ⇒ `seasonal: false, seasonalDefault: true`.

Resolved appearance (single pure function, single source for every consumer):

```ts
type BaseTheme = 'dark' | 'light';
type Season = 'winter' | 'spring' | 'summer' | 'autumn';
type AppearanceId = BaseTheme | `${Season}-night` | `${Season}-day`;
// seasonalActive = flags.seasonal && (pref ?? (flags.seasonalDefault ? 'on' : 'off')) === 'on'
// id = seasonalActive ? `${seasonFor(now)}-${base === 'dark' ? 'night' : 'day'}` : base
```

`seasonFor(date)` uses the calendar date in **Europe/Moscow** (Intl), independent of the device time zone: Dec–Feb winter, Mar–May spring, Jun–Aug summer, Sep–Nov autumn. Re-evaluate on visibility/focus return and once a minute while visible (cheap), so an open cabinet crosses a season boundary.

Telegram/other shells get `base` as the colour scheme and the resolved palette's surface/background colours (existing `ThemeColorsProvider` sync).

## 2. Palettes

Admin colours (`/cabinet/branding/colors`) remain the palette for `dark` / `light`. Seasonal ids use built-in palettes (code constants) and must not be overwritten by a late admin-colours response.

| id | bg | surface | accent (action) | decor/glint | text | text secondary |
| --- | --- | --- | --- | --- | --- | --- |
| winter-night | #020914 | #0A1D30 | #22D3EE | #B85AFF | #EFFAFF | #A1BCCA |
| winter-day | #E7F0F7 | #F7FBFE | #087F9C | #6F9FC2 | #173249 | #516F84 |
| spring-night | #071B1A | #153A32 | #FF9B9F | #A0D6B7 | #F2FAF3 | #B1CABE |
| spring-day | #F7F3E9 | #FFFDF5 | #AD415C | #719D7A | #294235 | #627969 |
| summer-night | #061522 | #102B3C | #37BAFF | #FFD36A | #F0FAFF | #A3BDCC |
| summer-day | #EEF8F7 | #FFFDF6 | #087E99 | #BE9671 | #153D49 | #59777F |
| autumn-night | #130A05 | #2A170D | #FF9426 | #FFD078 | #FFF4E7 | #C8AD96 |
| autumn-day | #F8F0E6 | #FFFBF5 | #B4530F | #E0A458 | #3A2416 | #7A5A44 |

Build a full `ThemeColors` per seasonal id: night ids fill `dark*` from the night row and `light*` from the matching day row; day ids the other way round; `accent` = that id's accent; `success/warning/error` = admin values except **autumn-night warning = #F4E870**. Feed it through the existing `computeThemeCssVars` / `applyThemeColors` (it already picks readable on-accent text and text shades).

Extra per-appearance tokens set on `:root` by the provider (also for `dark`/`light`):
- `--color-info` RGB triplet: night/dark `125, 211, 252`, day/light `2, 132, 199`, autumn-night `115, 209, 255`.
- `--color-urgent-400`: autumn-night `255, 118, 174` (others keep the CSS default).
- Contour/decor tokens: `--nc-glint`, `--nc-cta-a`, `--nc-cta-b` (values in the mockup `V` table: dark `#F0D9FF/#1C0F2C/#0D0716`, light `#C084FC/#FFFFFF/#F5EEFF`, winter-night `#CFFAFE/#0E2236/#05101E`, winter-day `#7DD3FC/#FFFFFF/#EEF6FB`, spring-night `#FFD6D8/#1B4339/#0A2420`, spring-day `#F29AA8/#FFFFFF/#FBF6EA`, summer-night `#FFE7A8/#14344B/#081A2A`, summer-day `#F2C46B/#FFFFFF/#EEF8F5`, autumn-night `#FFE2A8/#311B0E/#160B05`, autumn-day `#F0A35A/#FFFFFF/#FBF1E4`).

Null Pulse admin preset (add to `THEME_PRESETS`, id `null-pulse`, name "Null Pulse"): accent `#9333EA`; dark `#07040C / #160D23 / #F5F0FF / #B2A7C6`; light `#F4F1FA / #FFFFFF / #1C1528 / #5E5470`; success `#22C55E`, warning `#F59E0B`, error `#EF4444`.

## 3. First paint

Keep the existing inline scripts in `index.html`, extend them:
- The theme script also reads `cabinet-seasonal` and the cached enabled-themes (now with `seasonal`, `seasonalDefault`) and computes the expected appearance id with the same rules (Moscow month via `Intl.DateTimeFormat(..., {timeZone: 'Europe/Moscow', month: 'numeric'})`, wrapped in try/catch).
- New hint `cabinet-seasonal-hint` = `{ id, vars }` written whenever a seasonal palette is applied. The colours script applies it **only if** `hint.id === expected id`; otherwise it applies the existing admin hint (current behaviour). Same validation of names/values as today. Also set `data-appearance` on `<html>` with the expected id (CSS hooks use it).
- No flash of the base palette when a seasonal id is active and its hint matches.

## 4. Header button and admin

- Mobile header: new icon button **left of the moon/sun button**, visible only when `seasonal` is available. Icon: a palette (stroke icon like the others). `aria-pressed` = seasonal active, `aria-label`/`title` "Сезонное оформление" (+ season name in title). When active: highlighted with the accent (tinted bg + ring) and a small dot in the top-right corner coloured `--nc-glint`. Click: haptic + toggle `cabinet-seasonal`. The moon/sun button keeps toggling the base theme. Same toggle on the desktop header if it has the theme button.
- Below 360 px viewport width hide the "Null Core" brand text next to the logo in the mobile header (logo stays) so four buttons fit.
- If the mobile burger menu already has an appearance/theme item, add the seasonal switch there too; otherwise do not invent a new menu section.
- Admin → Theme tab, next to the existing dark/light switches: **"Сезонное оформление"** (availability, `seasonal`) and **"Включать по умолчанию"** (`seasonalDefault`, disabled-looking when availability is off). PATCH via `themeColorsApi.updateEnabledThemes`, update the cache/event like dark/light. Short hint text: the season follows the Moscow calendar; users can switch it off with the palette button.
- i18n: ru and en (and the other locale files if the locale completeness test requires it).

## 5. Visual fixes (all appearances)

- **Glass** (`getGlassColors`): dark `cardBg` = `linear-gradient(160deg, rgba(var(--color-dark-800), 0.84) 0%, rgba(var(--color-dark-900), 0.9) 100%)`, `cardBorder` = `rgba(var(--color-accent-400), 0.18)`, `innerBg` = `rgba(var(--color-dark-950), 0.42)`, `innerBorder` = `rgba(255,255,255,0.07)`; light `cardBg` = `linear-gradient(145deg, rgba(var(--color-champagne-50), 0.95) 0%, rgba(var(--color-champagne-50), 0.88) 100%)`. Bento cards (`bg-dark-900/70` bento surfaces) in dark get the same glass gradient and border. Dark glass cards get a 1px highlight line on top (`left/right 14%`, gradient accent-300 → accent-500 → transparent) — CSS, no DOM search.
- **Status «Активна»** on the subscription page uses the success role (bg success-500/12, border success-500/32, text success-400; light: success-700), not the traffic-zone colour. Limited/expired keep their roles.
- **Secondary actions neutral**: «Сменить тариф», «Докупить трафик» and the copy-link button: neutral border (`dark-50` at 14%), faint fill (5%), text `dark-100`; light: text colour at 4%/16%. Keep sizes, icons, handlers.
- **Several apps on one device = information**: the explanation box («… занимает 2 слота…») and the grouped slot borders use `--color-info` instead of warning.
- **Light `.btn-primary`** = accent-600 background, white text (instead of the hard-coded champagne).
- **Connect-device contour**: one shared component/class used by the subscription tile (currently `HoverBorderGradient`) and the home `DeviceSlots` «Подключить устройство» button (keep 52 px height, icon, label, handlers, limits/trial rules). Implementation: element `position: relative; isolation: isolate; overflow: hidden`; `::before` = square ~560px conic-gradient ring rotated by a **transform** animation (4.8 s linear) — `conic-gradient(from 0deg, accent-500/30% 0–225deg, accent-400 285deg, var(--nc-glint) 316deg, accent-500/30% 334–360deg)`; `::after` = `inset: 1.5px; border-radius: inherit;` fill `linear-gradient(135deg, var(--nc-cta-a), var(--nc-cta-b))`; soft glow `0 0 21px accent-500/24%`; text colour = theme text. Pause (`animation-play-state: paused`) when the page is hidden / Telegram inactive (`useAnimationPause`) and when disabled/limit reached/loading; `prefers-reduced-motion` ⇒ static ring. `focus-visible` outline kept. Other `HoverBorderGradient` consumers unchanged.

## 6. Backgrounds

- New background type **`liquid-light`** (bot accepts it): CSS-only component (no canvas, no RAF): 3–4 large radial-gradient blobs (`violet rgba(147,51,234,.55)`, `lilac rgba(214,140,255,.32)`, `deep rgba(126,34,206,.48)`) drifting with long `transform` keyframes (46 s / 37 s / 53 s alternate), `mix-blend-mode: screen` in dark, faint and static-ish in light (`applyThemeGround` semantics). Settings in the editor: three colours + speed (slow/normal/fast). Register everywhere: `BackgroundType`, both lazy maps in `registry.ts`, `backgroundRegistry` editor definition, `VALID_TYPES` in `backgroundConfig.ts`, locale labels.
- **Seasonal backgrounds** (code-selected, ignore the admin animation config while a seasonal id is active): one lazily loaded `SeasonalBackground` with the id as prop, rendered by the existing `BackgroundHost`/`BackgroundRenderer` (still one instance, no restart on navigation). Look exactly like the mockup `ground()`: winter = aurora gradients + snowfall (white flakes; day: white with blue shadow); spring = coral glow top, green glow bottom, sparse golden motes; summer = sky→sea gradient, moon (night) / sun (day), animated water shimmer lines only (no canvas); autumn = warm glow + falling maple leaves. Particle counts halved on mobile (<768 px).
- `prefers-reduced-motion`, background disabled, or paused ⇒ the same scene **static** (do not return `null` for these two types; make reduced-motion reactive via `matchMedia` change listener). Pause with `useAnimationPause`.

## 7. Seasonal decor

Component `SeasonalDecorSlot` wrapping an element: `position: relative; container-type: inline-size;` + absolutely positioned decor layer (`pointer-events: none; aria-hidden`), rendered only when a seasonal id is active. Slots and art (positions/sizes exactly as `DECOR` in the mockup source, using `cqw` where given):

| season | `corner` (main card) | `connect` | `renew` |
| --- | --- | --- | --- |
| winter | snow cap left + snowman over the top-right corner | snow on the right | snow along the whole top edge |
| spring | `gardenBed` over the top-right corner | tulip right | daffodil left |
| summer | sand left + palm right | shell right | wave along the top edge |
| autumn | maple cluster over the top-right corner | single leaf right | three leaves left |

Where: `corner` on the subscription page main card, the home subscription/traffic card, the balance main card; `connect` on both contour CTAs; `renew` on «Продлить подписку». No decor on tariffs. Day variants: decor gets `filter: drop-shadow(0 2px 3px rgba(60,100,140,.28))`. Unique SVG gradient ids per instance. No DOM querying, no scroll listeners, no `getBoundingClientRect`.

## 8. Not in scope

Snow "flurry" on tap; server-side sync of preferences; changing the bot banner (operational, done separately).

## 9. Checks

`npm run type-check`, `npx vitest run <touched areas>` (full `npx vitest run` at the end of the last task), Biome check on touched files, `npm run build`. After build: `grep -lE 'static\s*\{' dist/assets/*.js` must be empty (iOS 16 target). Do not update dependencies.
