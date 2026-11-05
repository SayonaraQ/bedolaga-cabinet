// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Info from './Info';

const state = vi.hoisted(() => ({ subscription: null as unknown, devices: 1, get: vi.fn() }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options && 'count' in options ? `${key}:${options.count}` : key,
    i18n: { language: 'ru' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('../api/client', () => ({ default: { get: (...args: unknown[]) => state.get(...args) } }));
vi.mock('../api/infoPages', () => ({
  infoPagesApi: { getTabReplacements: async () => ({}), getPages: async () => [] },
}));
vi.mock('../api/promo', () => ({ promoApi: { getLoyaltyTiers: async () => ({ tiers: [] }) } }));

const FAQ = [
  {
    id: 9,
    title: 'Что делать, если VPN не работает?',
    content: '<p>Шаги</p>',
    order: 5,
    category: 'trouble',
  },
  { id: 1, title: 'Как подключить VPN?', content: '<p>Кабинет</p>', order: 1, category: 'connect' },
  {
    id: 49,
    title: 'Какой трафик считается по тарифу?',
    content: '<p>Только «Белые списки»</p>',
    order: 21,
    category: 'whitelist',
  },
  {
    id: 52,
    title: 'Как докупить трафик?',
    content: '<p>Кнопка</p>',
    order: 24,
    category: 'whitelist',
  },
  {
    id: 21,
    title: 'Что прислать в поддержку?',
    content: '<p>Скриншот</p>',
    order: 34,
    category: 'support',
  },
];

beforeEach(() => {
  state.subscription = null;
  state.devices = 1;
  state.get.mockReset();
  state.get.mockImplementation(async (path: string) => {
    if (path.endsWith('/visibility'))
      return { data: { faq: true, rules: true, offer: true, privacy: true } };
    if (path.endsWith('/faq')) return { data: FAQ };
    if (path.endsWith('/support-config')) return { data: { tickets_enabled: true } };
    if (path === '/cabinet/subscription')
      return { data: { has_subscription: !!state.subscription, subscription: state.subscription } };
    if (path.endsWith('/devices'))
      return { data: { devices: [], total: state.devices, device_limit: 3 } };
    const content = path.endsWith('/rules')
      ? '<p>Запрещается скачивать torrent-файлы.</p>'
      : '<p>Документ сервиса.</p>';
    return { data: { content, updated_at: '2026-06-19T00:00:00Z' } };
  });
});
afterEach(cleanup);

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/info']}>
        <Info />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

it('renders without a subscription: no card, topics and documents are there', async () => {
  mount();
  expect(await screen.findByText('help.topics.trouble.title')).toBeTruthy();
  expect(screen.getByText('help.topics.whitelist.title')).toBeTruthy();
  expect(screen.getByText('help.topics.count:2')).toBeTruthy();
  expect(screen.queryByText('help.situation.label')).toBeNull();
  expect(await screen.findByText('help.docs.rules')).toBeTruthy();
  // Тема «Поддержка» — не плитка, а вопрос в блоке «Не нашли ответ?».
  expect(screen.queryByText('help.topics.support.title')).toBeNull();
  expect(screen.getByText('Что прислать в поддержку?')).toBeTruthy();
});

it('shows the whitelist card when traffic is used up', async () => {
  state.subscription = {
    id: 5,
    status: 'active',
    is_trial: false,
    is_active: true,
    is_expired: false,
    is_limited: false,
    days_left: 20,
    traffic_limit_gb: 10,
    traffic_used_gb: 10,
    device_limit: 3,
    tariff_id: 1,
    next_traffic_refresh_at: null,
  };
  mount();
  expect(await screen.findByText('help.situation.trafficOut.title')).toBeTruthy();
  expect(
    screen.getByRole('link', { name: 'help.situation.trafficOut.action' }).getAttribute('href'),
  ).toBe('/subscriptions/5');
  expect(
    screen.getByRole('link', { name: /Какой трафик считается по тарифу/ }).getAttribute('href'),
  ).toBe('/info/faq/49');
});

it('searches questions and documents', async () => {
  mount();
  await screen.findByText('help.topics.trouble.title');
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'трафик' } });
  expect(await screen.findByText('help.searchQuestions · 2')).toBeTruthy();
  expect(screen.queryByText('help.topics.trouble.title')).toBeNull();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'торрент' } });
  expect(await screen.findByText('help.searchDocs · 1')).toBeTruthy();
});

it('a one-letter query keeps the regular page', async () => {
  mount();
  await screen.findByText('help.topics.trouble.title');
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'т' } });
  expect(screen.getByText('help.topics.trouble.title')).toBeTruthy();
  expect(screen.queryByText(/help.searchNothing/)).toBeNull();
});
