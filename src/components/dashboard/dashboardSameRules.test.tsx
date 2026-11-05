// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlatformProvider } from '@/platform/PlatformProvider';
import type { Subscription } from '@/types';
import ManagedTrafficSummary from '@/components/subscription/ManagedTrafficSummary';

/**
 * Главная по тем же правилам, что страница подписки (владелец 05.11.2026):
 * - кончился трафик белых списков — VPN работает, поэтому карточка обычная
 *   (слоты, срок), сверху предупреждение с «Докупить трафик»;
 * - главная кнопка состояния — та же, что в карточке срока на странице подписки
 *   (subscriptionCardCta), у активной — только когда до конца ≤ 3 дней;
 * - у триала плитка «Пробный период», у старой подписки «Без тарифа»;
 * - отключённая админом — «Подписка отключена» и «Написать в поддержку»;
 * - дата сброса трафика видна и у legacy-подписок.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ru', changeLanguage: () => Promise.resolve() },
  }),
  Trans: ({ children }: { children?: unknown }) => children ?? null,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

afterEach(cleanup);

const sub = (overrides: Partial<Subscription> = {}): Subscription => ({
  id: 42,
  status: 'active',
  is_trial: false,
  start_date: '2026-10-01T00:00:00Z',
  end_date: '2026-11-27T00:00:00Z',
  days_left: 22,
  hours_left: 0,
  minutes_left: 0,
  time_left_display: '',
  traffic_limit_gb: 100,
  traffic_used_gb: 12,
  traffic_used_percent: 12,
  device_limit: 3,
  connected_squads: [],
  servers: [],
  autopay_enabled: false,
  autopay_days_before: 3,
  subscription_url: 'https://example.com/sub/abc',
  hide_subscription_link: false,
  is_active: true,
  is_expired: false,
  is_limited: false,
  tariff_id: 7,
  tariff_name: 'Стандарт',
  requires_tariff_selection: false,
  ...overrides,
});

const idleMutation = { mutate: () => {}, isPending: false } as unknown as Parameters<
  typeof import('./SubscriptionCardActive').default
>[0]['refreshTrafficMutation'];

function wrap(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PlatformProvider>
        <MemoryRouter initialEntries={['/']}>{node}</MemoryRouter>
      </PlatformProvider>
    </QueryClientProvider>,
  );
}

async function renderActive(s: Subscription, connected = 1) {
  const Card = (await import('./SubscriptionCardActive')).default;
  const devices = Array.from({ length: connected }, (_, i) => ({
    hwid: `hw-${i}`,
    platform: 'Android',
    device_model: 'Xiaomi 25102PCBEG',
    created_at: null,
    app: 'INCY',
  }));
  return wrap(
    <Card
      subscription={s}
      trafficData={null}
      refreshTrafficMutation={idleMutation}
      trafficRefreshCooldown={0}
      devices={devices}
    />,
  );
}

describe('главная: активная карточка по правилам страницы подписки', () => {
  it('кончился трафик: предупреждение с «Докупить трафик», но слоты и срок на месте', async () => {
    await renderActive(sub({ status: 'limited', is_active: false, is_limited: true }));

    const warning = screen.getByTestId('traffic-limited');
    expect(within(warning).getByText('subscription.trafficLimitedTitle')).toBeTruthy();
    expect(
      within(warning)
        .getByRole('link', { name: /subscription\.buyTrafficButton/ })
        .getAttribute('href'),
    ).toBe('/subscriptions/42');
    expect(screen.getByText('dashboard.slots.title')).toBeTruthy();
    expect(screen.getByText('dashboard.remaining')).toBeTruthy();
    expect(screen.getByRole('link', { name: /subscription\.extend/ }).getAttribute('href')).toBe(
      '/subscriptions/42/renew',
    );
  });

  it('осталось ≤ 3 дней: «Продлить подписку» прямо в карточке', async () => {
    await renderActive(sub({ days_left: 2 }));
    expect(screen.getByRole('link', { name: /subscription\.extend/ }).getAttribute('href')).toBe(
      '/subscriptions/42/renew',
    );
  });

  it('активна и до конца далеко: кнопки продления в карточке нет', async () => {
    await renderActive(sub());
    expect(screen.queryByRole('link', { name: /subscription\.extend/ })).toBeNull();
  });

  it('триал: плитка «Пробный период», главная кнопка «Выбрать тариф», без «Освободить слот»', async () => {
    await renderActive(
      sub({
        status: 'trial',
        is_trial: true,
        tariff_id: undefined,
        tariff_name: undefined,
        device_limit: 1,
      }),
    );

    expect(screen.getByText('subscription.trialStatus', { selector: 'div' })).toBeTruthy();
    expect(screen.queryByText('subscription.currentPlan')).toBeNull();
    expect(
      screen
        .getByRole('link', { name: /subscription\.cardCta\.chooseTariff/ })
        .getAttribute('href'),
    ).toBe('/subscription/purchase');
    expect(screen.queryByText('dashboard.slots.freeUp')).toBeNull();
  });

  it('старая подписка без тарифа: «Без тарифа» и «Перейти на тариф»', async () => {
    await renderActive(
      sub({ tariff_id: undefined, tariff_name: undefined, requires_tariff_selection: true }),
    );

    expect(screen.getByText('subscription.legacy.noTariff')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: /subscription\.cta\.moveToTariff/ }).getAttribute('href'),
    ).toBe('/subscription/purchase?subscriptionId=42');
  });
});

describe('главная: отключённая подписка', () => {
  it('пишет «Подписка отключена» и ведёт в поддержку, а не «истекла» и «Продлить»', async () => {
    const Card = (await import('./SubscriptionCardExpired')).default;
    wrap(
      <Card
        subscription={sub({
          status: 'disabled',
          is_active: false,
          end_date: '2026-11-19T00:00:00Z',
        })}
      />,
    );

    expect(screen.getByText('dashboard.disabled.title')).toBeTruthy();
    expect(screen.queryByText('dashboard.expired.title')).toBeNull();
    expect(
      screen
        .getByRole('link', { name: /subscription\.noOptionsContactSupport/ })
        .getAttribute('href'),
    ).toBe('/support');
    expect(screen.queryByText('dashboard.expired.quickRenew')).toBeNull();
    expect(screen.queryByText('dashboard.expired.tariffs')).toBeNull();
  });
});

describe('дата сброса трафика у legacy-подписки', () => {
  it('показывается, даже если ответ обновления трафика принёс null', () => {
    render(
      <ManagedTrafficSummary
        subscription={{
          traffic_accounting_mode: 'legacy',
          next_traffic_refresh_at: '2026-12-01T00:20:00Z',
        }}
        refreshed={{ traffic_accounting_mode: 'legacy', next_traffic_refresh_at: null }}
      />,
    );
    expect(screen.getByText('subscription.accounting.nextRefresh')).toBeTruthy();
    expect(screen.queryByText('subscription.accounting.available')).toBeNull();
  });

  it('скрыта там, где страница пишет её сама', () => {
    const { container } = render(
      <ManagedTrafficSummary
        subscription={{
          traffic_accounting_mode: 'legacy',
          next_traffic_refresh_at: '2026-12-01T00:20:00Z',
        }}
        hideNextRefresh
      />,
    );
    expect(container.textContent).toBe('');
  });
});
