// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import type { Subscription } from '@/types';
import { SituationCard } from './SituationCard';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
afterEach(cleanup);

const sub = {
  id: 5,
  status: 'active',
  is_trial: false,
  is_active: true,
  is_limited: false,
  is_daily: false,
  tariff_id: 1,
  traffic_limit_gb: 10,
  traffic_used_gb: 9,
} as unknown as Subscription;

const page = (id: number, title: string) => ({ id, title, content: '<p>a</p>', order: id });

function mount(faq: ReturnType<typeof page>[]) {
  render(
    <MemoryRouter>
      <SituationCard
        situation={{ kind: 'trafficLow', usedGb: 9, limitGb: 10 }}
        subscription={sub}
        faq={faq}
      />
    </MemoryRouter>,
  );
}

it('low traffic: the saving tips are the main button, buying traffic is a row below', () => {
  mount([page(53, 'Как расходовать трафик экономнее?'), page(49, 'Какой трафик считается?')]);
  expect(
    screen.getByRole('link', { name: 'help.situation.trafficLow.action' }).getAttribute('href'),
  ).toBe('/info/faq/53');
  expect(
    screen.getByRole('link', { name: /help.situation.trafficLow.buy/ }).getAttribute('href'),
  ).toBe('/subscriptions/5');
  expect(screen.getByRole('link', { name: /Какой трафик считается/ }).getAttribute('href')).toBe(
    '/info/faq/49',
  );
});

it('without the tips answer (FAQ rolled back) buying traffic becomes the main button, no dead links', () => {
  mount([]);
  expect(screen.queryByRole('link', { name: 'help.situation.trafficLow.action' })).toBeNull();
  const links = screen.getAllByRole('link');
  expect(links.map((l) => l.getAttribute('href'))).toEqual(['/subscriptions/5']);
  expect(links[0].textContent).toBe('help.situation.trafficLow.buy');
});
