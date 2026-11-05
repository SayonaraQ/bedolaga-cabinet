// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PlatformProvider } from '@/platform/PlatformProvider';
import { ToastProvider } from '@/components/Toast';

/**
 * Страница «Подписка» по макету, утверждённому 05.11.2026:
 * - «Сменить тариф» — под названием тарифа, с бликом;
 * - «Продлить подписку» — в карточке «Осталось», пульсирует;
 * - под полосой трафика «Следующий сброс / трафика: дата» и «Докупить трафик»;
 * - блок «Дополнительные опции» и нижний список «Мои устройства» заменены
 *   разделом «Устройства» сразу под карточкой подписки.
 */

const state = vi.hoisted(() => ({ subscription: {} as Record<string, unknown> }));
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
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </PlatformProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
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

  const renew = screen.getAllByRole('link', { name: 'subscription.extend' });
  expect(renew).toHaveLength(1);
  expect(renew[0].className).toContain('cta-pulse');
  expect(
    within(screen.getByTestId('countdown-card')).getByRole('link', { name: 'subscription.extend' }),
  ).toBe(renew[0]);
});

it('shows the next traffic reset beside «buy traffic», which opens the purchase form', async () => {
  renderPage();

  expect(await screen.findByText('subscription.nextTrafficReset.line1')).toBeTruthy();
  const buy = screen.getByRole('button', { name: /subscription\.buyTraffic/ });
  expect(buy.className).toContain('cta-shine');

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

  fireEvent.click(copy);
  // Пока горит галочка «скопировано», ореол не нужен.
  expect(copy.className).not.toContain('copy-link-attention');
  localStorage.removeItem('sub_link_copied_42');
});
