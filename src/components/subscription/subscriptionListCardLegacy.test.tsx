// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlatformProvider } from '@/platform/PlatformProvider';
import type { SubscriptionListItem } from '@/types';

/**
 * Карточка старой подписки в списке (мультитариф, главная и «Мои подписки»).
 *
 * Старая подписка куплена в классике, тарифа нет, оператор на тарифах. В строке
 * статусов у неё стояло «✕ Автопродление» — автоплатёж ей вообще недоступен.
 * Вместо этого карточка подсказывает единственный путь: «Перейти на тариф».
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ru', changeLanguage: () => Promise.resolve() },
  }),
  Trans: ({ children }: { children?: unknown }) => children ?? null,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const item = (overrides: Partial<SubscriptionListItem> = {}): SubscriptionListItem => ({
  id: 42,
  status: 'active',
  tariff_id: null,
  tariff_name: null,
  traffic_limit_gb: 0,
  traffic_used_gb: 1,
  device_limit: 3,
  end_date: '2026-10-07T00:00:00Z',
  subscription_url: null,
  subscription_crypto_link: null,
  is_trial: false,
  autopay_enabled: false,
  connected_squads: [],
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

afterEach(() => {
  cleanup();
});

it('uses the success role and readable light text for the active badge', async () => {
  await renderCard(item());
  const badge = screen.getByText('subscription.statusActive');
  expect(badge.className).toContain('bg-success-500/[0.12]');
  expect(badge.className).toContain('border-success-500/[0.32]');
  expect(badge.className).toContain('text-success-400');
  expect(badge.className).toContain('light:text-success-700');
});

it.each([
  ['limited', false, 'subscription.statusLimited', 'warning'],
  ['expired', false, 'subscription.statusExpired', 'error'],
  ['trial', true, 'subscription.statusTrial', 'warning'],
] as const)('keeps the %s badge role', async (status, is_trial, label, role) => {
  await renderCard(item({ status, is_trial }));
  expect(screen.getByText(label).className).toContain(`text-${role}-400`);
});

async function renderCard(sub: SubscriptionListItem) {
  const Card = (await import('./SubscriptionListCard')).default;
  render(
    <PlatformProvider>
      <MemoryRouter>
        <Card subscription={sub} onClick={() => {}} />
      </MemoryRouter>
    </PlatformProvider>,
  );
}

describe('старая подписка в списке', () => {
  it('даёт настоящую кнопку-ссылку на витрину вместо статуса автопродления', async () => {
    await renderCard(item({ requires_tariff_selection: true }));

    const move = await screen.findByRole('link', { name: 'subscription.cta.moveToTariff' });
    expect(move.getAttribute('href')).toBe('/subscription/purchase?subscriptionId=42');
    expect(move.className).toContain('btn-');
    expect(screen.queryByText('subscription.autopay')).toBeNull();
  });

  it('обычная подписка с тарифом показывает автопродление как раньше', async () => {
    await renderCard(
      item({ tariff_id: 7, tariff_name: 'Базовый', requires_tariff_selection: false }),
    );

    expect(await screen.findByText('subscription.autopay')).toBeTruthy();
    expect(screen.queryByText('subscription.cta.moveToTariff')).toBeNull();
  });
});

it.each([0, 120])(
  'does not present neutral counters as known usage for managed limit %s',
  async (limit) => {
    await renderCard(
      item({
        tariff_id: 7,
        traffic_limit_gb: limit,
        traffic_used_gb: 0,
        traffic_accounting_mode: 'managed',
        traffic_remaining_gb: null,
      }),
    );
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText('∞')).toBeNull();
    expect(screen.queryByText(/^0\.0 \/ /)).toBeNull();
  },
);
