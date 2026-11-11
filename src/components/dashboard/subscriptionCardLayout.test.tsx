// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformProvider } from '@/platform/PlatformProvider';
import type { Subscription } from '@/types';
import type { Season } from '@/theme/appearance';

const appearance = vi.hoisted(() => ({ season: null as Season | null }));
vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    isDark: true,
    isLight: false,
    season: appearance.season,
    seasonalActive: appearance.season !== null,
  }),
}));
beforeEach(() => {
  appearance.season = null;
});

/**
 * Вёрстка карточки подписки на телефоне.
 *
 * У тарифа с длинным именем («🟡 Компания - 10 устройств») плитка «Осталось»
 * уезжала за правый край карточки: у флекс-элемента без `min-w-0` минимальная
 * ширина равна ширине неразрывного текста внутри.
 *
 * jsdom не считает раскладку, поэтому здесь сторожатся сами признаки:
 * ограничитель ширины у обеих плиток и сетка слотов устройств.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ru', changeLanguage: () => Promise.resolve() },
  }),
  Trans: ({ children }: { children?: unknown }) => children ?? null,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const subscription = (overrides: Partial<Subscription> = {}): Subscription => ({
  id: 42,
  status: 'active',
  is_trial: false,
  start_date: '2026-08-07T00:00:00Z',
  end_date: '2029-08-29T00:00:00Z',
  days_left: 1085,
  hours_left: 0,
  minutes_left: 0,
  time_left_display: '',
  traffic_limit_gb: 250,
  traffic_used_gb: 22.2,
  traffic_used_percent: 9,
  device_limit: 10,
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
  tariff_name: '🟡 Компания - 10 устройств',
  ...overrides,
});

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

const idleMutation = {
  mutate: () => {},
  isPending: false,
} as unknown as Parameters<
  typeof import('./SubscriptionCardActive').default
>[0]['refreshTrafficMutation'];

async function renderCard(sub: Subscription, connectedDevices = 0) {
  const devices = Array.from({ length: connectedDevices }, (_, i) => ({
    hwid: `hw-${i}`,
    platform: 'iOS',
    device_model: `iPhone ${i}`,
    created_at: null,
    app: 'Happ',
  }));
  const Card = (await import('./SubscriptionCardActive')).default;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { container } = render(
    <QueryClientProvider client={client}>
      <PlatformProvider>
        <MemoryRouter initialEntries={['/']}>
          <Card
            subscription={sub}
            trafficData={null}
            refreshTrafficMutation={idleMutation}
            trafficRefreshCooldown={0}
            devices={devices}
          />
        </MemoryRouter>
      </PlatformProvider>
    </QueryClientProvider>,
  );
  return container;
}

describe('ряд «Тариф» + «Осталось»', () => {
  it('обе плитки умеют сжиматься — длинное имя тарифа не выталкивает соседа', async () => {
    const container = await renderCard(subscription());

    const row = container.querySelector('.mb-5.flex.gap-2\\.5');
    expect(row).toBeTruthy();
    const plates = [...(row?.children ?? [])];
    expect(plates).toHaveLength(2);
    for (const plate of plates) {
      expect(plate.className).toContain('min-w-0');
      expect(plate.className).toContain('flex-1');
    }
  });

  it('имя тарифа переносится по словам, а не обрезается в одну строку', async () => {
    await renderCard(subscription());

    const name = screen.getByText('🟡 Компания - 10 устройств');
    expect(name.className).toContain('line-clamp-2');
    expect(name.className).not.toContain('truncate');
    // Перенос с дефисом по слогам; разрыв посреди слова — только если слово
    // длиннее строки. На 320 px шрифт меньше, чтобы «Семейный» влезал целиком.
    expect(name.className).toContain('hyphens-auto');
    expect(name.className).toContain('max-[359px]:text-[15px]');
  });

  it('обе плитки по одному шаблону: значок с подписью, значение, строка снизу', async () => {
    const container = await renderCard(subscription());

    const plates = [...(container.querySelector('.mb-5.flex.gap-2\\.5')?.children ?? [])];
    for (const plate of plates) {
      expect(plate.className).toContain('flex-col');
      const icon = plate.querySelector('[data-testid="tile-icon"]');
      // Значок не сжимается на узком экране (раньше на 320 px превращался в полоску).
      expect(icon?.className).toContain('shrink-0');
      expect(plate.querySelector('[data-testid="tile-footer"]')?.className).toContain('mt-auto');
    }
  });

  it('дата окончания — под числом дней, а не под названием тарифа', async () => {
    const container = await renderCard(subscription());

    const [tariff, days] = [...(container.querySelector('.mb-5.flex.gap-2\\.5')?.children ?? [])];
    expect(days.textContent).toContain('dashboard.validUntil');
    expect(tariff.textContent).not.toContain('dashboard.validUntil');
  });

  it('плитка «Тариф» ведёт к смене тарифа и подписывает это', async () => {
    const container = await renderCard(subscription());

    const tariff = container.querySelector('.mb-5.flex.gap-2\\.5')?.children[0] as HTMLElement;
    expect(tariff.getAttribute('href')).toBe('/subscription/purchase?subscriptionId=42');
    const footer = tariff.querySelector('[data-testid="tile-footer"]') as HTMLElement;
    // Полная подпись от 360 px, короткая — уже.
    expect(footer.textContent).toContain('subscription.switchTariff.title');
    expect(footer.textContent).toContain('dashboard.switchTariffShort');
    expect(screen.getByText('subscription.switchTariff.title').className).toContain(
      'max-[359px]:hidden',
    );
    expect(screen.getByText('dashboard.switchTariffShort').className).toContain(
      'min-[360px]:hidden',
    );
  });

  it('где смена недоступна (пробный период), плитка ведёт на подписку без «Сменить»', async () => {
    const container = await renderCard(subscription({ is_trial: true, tariff_id: undefined }));

    const tariff = container.querySelector('.mb-5.flex.gap-2\\.5')?.children[0] as HTMLElement;
    expect(tariff.getAttribute('href')).toBe('/subscriptions/42');
    expect(tariff.querySelector('[data-testid="tile-footer"]')).toBeNull();
    expect(screen.queryByText('dashboard.switchTariffShort')).toBeNull();
  });
});

describe('слоты устройств', () => {
  // Точки «2 из 5» заменены ячейками «приложение · устройство»: на 10 слотах
  // сетка в 4 колонки (три ряда), а не 10 точек, съедавших заголовок.
  it('рисует занятые и свободные ячейки до лимита', async () => {
    await renderCard(subscription({ device_limit: 5 }), 2);

    expect(screen.getAllByText('Happ')).toHaveLength(2);
    expect(screen.getAllByText('dashboard.slots.free')).toHaveLength(3);
  });

  it('десять слотов — сетка в четыре колонки', async () => {
    const container = await renderCard(subscription({ device_limit: 10 }), 10);

    const grid = container.querySelector(
      '[data-onboarding="connect-devices"] .grid',
    ) as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe('repeat(4, minmax(0, 1fr))');
    expect(screen.queryByText('dashboard.slots.free')).toBeNull();
  });
});

it.each(['winter', 'spring', 'summer', 'autumn'] as const)(
  'renders the %s home main-card and connect slots without wrapping the slot grid',
  async (season) => {
    appearance.season = season;
    const container = await renderCard(subscription());
    const corner = container.querySelector('[data-seasonal-slot="corner"]');
    expect(corner?.firstElementChild?.className).toContain('glass-card');
    const connect = screen.getByRole('button', { name: 'dashboard.connectDevice' });
    expect(connect.parentElement?.getAttribute('data-seasonal-slot')).toBe('connect');
    expect(connect.className).toContain('h-[52px]');
    expect(connect.parentElement?.parentElement?.className).toContain('flex-col');
    expect(container.querySelectorAll('[data-seasonal-slot]')).toHaveLength(2);
  },
);
