// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformProvider } from '@/platform/PlatformProvider';
import { ToastProvider } from '@/components/Toast';
import type { Season } from '@/theme/appearance';

/**
 * Страница «Подписка» по макету, утверждённому 05.11.2026:
 * - «Сменить тариф» — под названием тарифа, с бликом;
 * - «Продлить подписку» — в карточке «Осталось», пульсирует;
 * - под полосой трафика «Следующий сброс / трафика: дата» и «Докупить трафик»;
 * - блок «Дополнительные опции» и нижний список «Мои устройства» заменены
 *   разделом «Устройства» сразу под карточкой подписки.
 */

const state = vi.hoisted(() => ({
  subscription: {} as Record<string, unknown>,
  paused: false,
  season: null as Season | null,
  copy: vi.fn(async () => {}),
}));
vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    isDark: true,
    isLight: false,
    season: state.season,
    seasonalActive: state.season !== null,
  }),
}));
vi.mock('@/hooks/useAnimationLoop', () => ({ useAnimationPause: () => state.paused }));
vi.mock('@/utils/clipboard', () => ({ copyToClipboard: state.copy }));
const api = vi.hoisted(() => ({
  getSubscription: async () => ({ has_subscription: true, subscription: state.subscription }),
  getSubscriptions: async () => ({ subscriptions: [], multi_tariff_enabled: false }),
  getConnectionLink: async () => ({
    subscription_url: 'https://speed.example/sub/abc',
    display_link: 'https://speed.example/sub/abc',
    happ_redirect_link: null,
    happ_scheme_link: null,
    connect_mode: 'guide',
    hide_link: false,
    instructions: { steps: [] },
  }),
  getPurchaseOptions: async () => ({ sales_mode: 'tariffs', tariffs: [], balance_kopeks: 0 }),
  getDevices: async () => ({
    devices: [
      { hwid: 'HW-1', platform: 'iOS', device_model: 'iPhone 15', app: 'Happ', created_at: null },
    ],
    total: 1,
    device_limit: 3,
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: unknown) =>
      opts && typeof opts === 'object' && !Array.isArray(opts)
        ? `${key} ${Object.values(opts as Record<string, unknown>)
            .filter((v) => typeof v !== 'object')
            .join(' ')}`
        : typeof opts === 'string'
          ? key
          : key,
    i18n: { language: 'ru', changeLanguage: () => Promise.resolve() },
  }),
  Trans: ({ children }: { children?: unknown }) => children ?? null,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
// Остальные методы API (автоплатёж, перевыпуск, цены) — пустые ответы.
vi.mock('@/api/subscription', () => ({
  subscriptionApi: new Proxy(api, {
    get: (target, name: string) =>
      name in target ? target[name as keyof typeof target] : async () => ({}),
  }),
}));

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

import Subscription from './Subscription';

function Destination() {
  const location = useLocation();
  return <div data-testid="destination">{location.pathname + location.search}</div>;
}

function renderPage() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <PlatformProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={['/subscriptions/42']}>
            <Routes>
              <Route path="/subscriptions/:subscriptionId" element={<Subscription />} />
              <Route path="/subscription/purchase" element={<Destination />} />
              <Route path="/connection" element={<Destination />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </PlatformProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state.paused = false;
  state.season = null;
  state.copy.mockClear();
  state.subscription = {
    id: 42,
    status: 'active',
    is_active: true,
    is_trial: false,
    is_limited: false,
    is_expired: false,
    is_daily: false,
    start_date: '2026-10-01T00:00:00Z',
    end_date: '2026-11-27T00:00:00Z',
    days_left: 22,
    hours_left: 0,
    minutes_left: 0,
    time_left_display: '',
    traffic_limit_gb: 100,
    traffic_used_gb: 12,
    traffic_used_percent: 12,
    traffic_accounting_mode: 'managed',
    traffic_remaining_gb: 88,
    base_traffic_remaining_gb: 88,
    next_traffic_refresh_at: '2026-12-01T00:00:00Z',
    device_limit: 3,
    connected_squads: [],
    servers: [],
    autopay_enabled: false,
    autopay_days_before: 3,
    subscription_url: 'https://speed.example/sub/abc',
    hide_subscription_link: false,
    tariff_id: 7,
    tariff_name: 'Стандарт',
    requires_tariff_selection: false,
  };
});
afterEach(cleanup);

it('puts «change tariff» under the plan name and «renew» inside the countdown', async () => {
  renderPage();

  const change = await screen.findByRole('link', { name: 'subscription.switchTariff.title' });
  expect(change.className).toContain('cta-shine');
  expect(change.className).toContain('subscription-action-neutral');

  const renew = screen.getAllByRole('link', { name: 'subscription.extend' });
  expect(renew).toHaveLength(1);
  expect(renew[0].className).toContain('cta-pulse');
  expect(
    within(screen.getByTestId('countdown-card')).getByRole('link', { name: 'subscription.extend' }),
  ).toBe(renew[0]);
  const destination = change.getAttribute('href');
  fireEvent.click(change);
  expect(screen.getByTestId('destination').textContent).toBe(destination);
});

it('shows the next traffic reset beside «buy traffic», which opens the purchase form', async () => {
  renderPage();

  expect(await screen.findByText('subscription.nextTrafficReset.line1')).toBeTruthy();
  const buy = screen.getByRole('button', { name: /subscription\.buyTraffic/ });
  expect(buy.className).toContain('cta-shine');
  expect(buy.className).toContain('subscription-action-neutral');

  fireEvent.click(buy);
  expect(screen.getByText('subscription.additionalOptions.buyTrafficTitle')).toBeTruthy();
});

it('replaces «additional options» and the bottom device list with one devices section', async () => {
  const { container } = renderPage();

  await screen.findByText('Happ');
  expect(container.querySelector('#devices')).toBeTruthy();
  expect(screen.queryByText('subscription.additionalOptions.title')).toBeNull();
  expect(screen.queryByText('subscription.myDevices')).toBeNull();
  expect(
    screen.getByRole('button', { name: /subscription\.devicesSection\.addSlot/ }),
  ).toBeTruthy();
});

// Решение владельца 05.11.2026 (после просмотра всех состояний): главная кнопка
// у каждого состояния — в карточке срока, там же, где написано «Истекла»;
// общего блока внизу больше нет.
it.each([
  [
    'expired',
    { status: 'expired', is_active: false, is_expired: true, days_left: 0 },
    'subscription.extend',
    '/subscriptions/42/renew',
  ],
  [
    'traffic ran out',
    { status: 'limited', is_active: false, is_limited: true },
    'subscription.extend',
    '/subscriptions/42/renew',
  ],
  [
    'trial',
    { status: 'trial', is_trial: true, tariff_id: null },
    'subscription.cardCta.chooseTariff',
    '/subscription/purchase',
  ],
  [
    'legacy without a tariff',
    { tariff_id: null, requires_tariff_selection: true },
    'subscription.cta.moveToTariff',
    '/subscription/purchase?subscriptionId=42',
  ],
  [
    'disabled by an admin',
    { status: 'disabled', is_active: false },
    'subscription.noOptionsContactSupport',
    '/support',
  ],
])(
  '%s: the main action sits in the countdown card, not at the bottom',
  async (_name, over, label, href) => {
    Object.assign(state.subscription, over);
    renderPage();

    const card = await screen.findByTestId('countdown-card');
    const link = await within(card).findByRole('link', { name: label });
    expect(link.getAttribute('href')).toBe(href);
    expect(link.className).toContain('cta-pulse');
    expect(
      screen.queryByText(/subscription\.cta\.(expiredHint|activeHint|trialHint|moveToTariffHint)/),
    ).toBeNull();
  },
);

it('traffic ran out: «buy traffic» is in the warning that says so, once', async () => {
  Object.assign(state.subscription, { status: 'limited', is_active: false, is_limited: true });
  renderPage();

  const warning = await screen.findByTestId('traffic-limited');
  const buy = await within(warning).findByRole('button', { name: /subscription\.buyTraffic/ });
  expect(buy.className).toContain('cta-shine');
  expect(buy.className).toContain('subscription-action-neutral');
  expect(screen.getAllByRole('button', { name: /subscription\.buyTraffic/ })).toHaveLength(1);

  fireEvent.click(buy);
  expect(screen.getByText('subscription.additionalOptions.buyTrafficTitle')).toBeTruthy();
});

it('expired: «change tariff» under the plan name leads to the showcase', async () => {
  Object.assign(state.subscription, {
    status: 'expired',
    is_active: false,
    is_expired: true,
    days_left: 0,
  });
  renderPage();

  const change = await screen.findByRole('link', { name: 'subscription.switchTariff.title' });
  expect(change.getAttribute('href')).toBe('/subscription/purchase');
});

it('trial: «choose a plan» is also right in the trial banner', async () => {
  Object.assign(state.subscription, { status: 'trial', is_trial: true, tariff_id: null });
  renderPage();

  const banner = await screen.findByTestId('trial-banner');
  const choose = await within(banner).findByRole('link', {
    name: 'subscription.cardCta.chooseTariff',
  });
  expect(choose.getAttribute('href')).toBe('/subscription/purchase');
});

it('disabled by an admin: the countdown card says «disabled», not «expired»', async () => {
  Object.assign(state.subscription, { status: 'disabled', is_active: false });
  renderPage();

  const card = await screen.findByTestId('countdown-card');
  expect(within(card).getByText('subscription.disabledBadge')).toBeTruthy();
  expect(within(card).queryByText('subscription.expired')).toBeNull();
});

// Владелец 05.11.2026: у истёкшей карточка «Истекла» с продлением должна быть
// выше. Плитку и ссылку не прячем: на белых списках оплата без VPN недоступна,
// и после истечения по той же ссылке работает grace (только Telegram), чтобы
// дойти до оплаты. Поэтому у неработающей подписки карточка срока просто
// встаёт первой — над трафиком, плиткой и ссылкой.
it.each([
  ['expired', { status: 'expired', is_active: false, is_expired: true, days_left: 0 }, true],
  ['disabled by an admin', { status: 'disabled', is_active: false }, true],
  ['active', {}, false],
  [
    'traffic ran out: VPN still works',
    { status: 'limited', is_active: false, is_limited: true },
    false,
  ],
])('%s: countdown card comes first = %s; tile and link stay', async (_name, over, first) => {
  Object.assign(state.subscription, over);
  renderPage();

  const card = await screen.findByTestId('countdown-card');
  const tile = await screen.findByText('dashboard.connectDevice');
  const link = screen.getByText('https://speed.example/sub/abc');
  const traffic = screen.getByText('subscription.traffic');
  const before = (a: Node, b: Node) =>
    Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  expect(before(card, tile) && before(card, link) && before(card, traffic)).toBe(first);
  expect(before(tile, card) && before(link, card)).toBe(!first);
});

// Владелец 05.11.2026: кнопка копирования ссылки мигает всегда, а не до первого
// нажатия — раньше после одного копирования она гасла навсегда.
it('the copy-link button keeps pulsing even after the link was copied before', async () => {
  localStorage.setItem('sub_link_copied_42', '1');
  renderPage();

  const copy = await screen.findByRole('button', { name: 'subscription.copyLink' });
  expect(copy.className).toContain('copy-link-attention');
  expect(copy.className).toContain('subscription-action-neutral');
  expect(copy.title).toBe('subscription.copyLink');

  fireEvent.click(copy);
  expect(state.copy).toHaveBeenCalledWith('https://speed.example/sub/abc');
  // Пока горит галочка «скопировано», ореол не нужен.
  expect(copy.className).not.toContain('copy-link-attention');
  localStorage.removeItem('sub_link_copied_42');
});

it.each([
  [{}, 'subscription.active', 'success'],
  [{ is_trial: true, status: 'trial' }, 'subscription.trialStatus', 'accent'],
  [
    { is_active: false, is_limited: true, status: 'limited' },
    'subscription.trafficLimited',
    'warning',
  ],
  [{ is_active: false, is_expired: true, status: 'expired' }, 'subscription.expired', 'critical'],
])('preserves the %s status role without using the traffic zone', async (over, label, role) => {
  Object.assign(state.subscription, over);
  // A high traffic zone must not turn an active badge orange/red.
  state.subscription.traffic_used_percent = 95;
  renderPage();
  await screen.findByTestId('countdown-card');
  const badge = screen.getAllByText(label as string).find((element) => element.tagName === 'SPAN');
  expect(badge?.className).toContain(`bg-${role}-500/[0.12]`);
  expect(badge?.className).toContain(`border-${role}-500/`);
  if (role === 'success') {
    expect(badge?.className).toContain('border-success-500/[0.32]');
    expect(badge?.className).toContain('text-success-400');
    expect(badge?.className).toContain('light:text-success-700');
  }
});

it.each([false, true])('renders the subscription contour with page paused=%s', async (paused) => {
  state.paused = paused;
  renderPage();
  const connect = await screen.findByRole('button', { name: /dashboard\.connectDevice/ });
  await waitFor(() => expect(connect.hasAttribute('disabled')).toBe(false));
  expect(connect.className).toContain('connect-device-contour');
  expect(connect.getAttribute('data-paused')).toBe(String(paused));
  fireEvent.click(connect);
  expect(screen.getByTestId('destination').textContent).toBe('/connection?sub=42');
});

it('pauses and disables the subscription contour at the device limit', async () => {
  state.subscription.device_limit = 1;
  renderPage();
  await screen.findByText('Happ');
  const connect = screen.getByRole('button', { name: /dashboard\.connectDevice/ });
  expect(connect.className).toContain('connect-device-contour');
  expect(connect.getAttribute('data-paused')).toBe('true');
  expect(connect.hasAttribute('disabled')).toBe(true);
  fireEvent.click(connect);
  expect(screen.queryByTestId('destination')).toBeNull();
});

it.each(['winter', 'spring', 'summer', 'autumn'] as const)(
  'places all three %s slots outside the subscription card and actions',
  async (season) => {
    state.season = season;
    const { container } = renderPage();
    const connect = await screen.findByRole('button', { name: /dashboard\.connectDevice/ });
    const renew = screen.getByRole('link', { name: 'subscription.extend' });
    expect(
      [...container.querySelectorAll('[data-seasonal-slot]')].map((node) =>
        node.getAttribute('data-seasonal-slot'),
      ),
    ).toEqual(['corner', 'connect', 'renew']);
    const corner = container.querySelector('[data-seasonal-slot="corner"]');
    expect(corner?.firstElementChild?.className).toContain('glass-card');
    expect(connect.parentElement?.getAttribute('data-seasonal-slot')).toBe('connect');
    expect(connect.className).not.toContain('mb-5');
    expect(connect.parentElement?.parentElement?.className).toBe('mb-5');
    expect(renew.parentElement?.getAttribute('data-seasonal-slot')).toBe('renew');
  },
);

it('does not put renewal decor on the trial choose-tariff action', async () => {
  state.season = 'winter';
  Object.assign(state.subscription, { status: 'trial', is_trial: true, tariff_id: null });
  const { container } = renderPage();
  await screen.findByTestId('countdown-card');
  expect(container.querySelector('[data-seasonal-slot="corner"]')).toBeTruthy();
  expect(container.querySelector('[data-seasonal-slot="renew"]')).toBeNull();
});

// Владелец 11.11.2026, вариант «Табло»: срок прижимался влево, а кнопка «Продлить»
// растягивалась на всю ширину (на компьютере — на 1330 px). Теперь таймер разложен
// на ячейки во всю ширину, дата — в шапке карточки, на компьютере ячейки и кнопка
// стоят в одну строку.
describe('countdown board', () => {
  const inDays = (days: number, hours = 5) =>
    new Date(Date.now() + days * 86_400_000 + hours * 3_600_000).toISOString();

  it('active: four cells with captions and the end date in the card header', async () => {
    Object.assign(state.subscription, { end_date: inDays(78), days_left: 78 });
    renderPage();

    const card = await screen.findByTestId('countdown-card');
    const cells = within(card).getAllByTestId('countdown-cell');
    expect(cells).toHaveLength(4);
    expect(cells[0].textContent).toContain('78');
    expect(cells.map((c) => c.lastElementChild?.textContent)).toEqual([
      'subscription.daysShort',
      'subscription.countdownCell.hours',
      'subscription.countdownCell.minutes',
      'subscription.countdownCell.seconds',
    ]);
    expect(within(card).getByTestId('countdown-date').textContent).toContain(
      'dashboard.validUntil',
    );
    // Ячейки и кнопка делят строку на компьютере; на телефоне кнопка под ячейками.
    const grid = within(card).getByTestId('countdown-cells');
    expect(grid.className).toContain('sm:flex-1');
    const action = within(card).getByRole('link', { name: 'subscription.extend' });
    expect(action.closest('[data-testid="countdown-action"]')?.className).toContain('sm:w-[280px]');
  });

  it('less than a day left: no days cell', async () => {
    Object.assign(state.subscription, { end_date: inDays(0, 5), days_left: 0 });
    renderPage();

    const card = await screen.findByTestId('countdown-card');
    expect(within(card).getAllByTestId('countdown-cell')).toHaveLength(3);
  });

  it('expired: a plate instead of the cells, no end date', async () => {
    Object.assign(state.subscription, {
      status: 'expired',
      is_active: false,
      is_expired: true,
      days_left: 0,
    });
    renderPage();

    const card = await screen.findByTestId('countdown-card');
    expect(within(card).queryAllByTestId('countdown-cell')).toHaveLength(0);
    expect(within(card).getByText('subscription.expired')).toBeTruthy();
    expect(within(card).queryByTestId('countdown-date')).toBeNull();
  });
});
