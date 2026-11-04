// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RenewBar } from './RenewBar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key} ${Object.values(opts).join(' ')}` : key,
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('@/platform', () => ({
  useHaptic: () => ({ impact: vi.fn(), notification: vi.fn() }),
  usePlatform: () => ({ haptic: { impact: vi.fn(), notification: vi.fn() } }),
}));

const subscription = {
  id: 42,
  status: 'active',
  is_active: true,
  is_limited: false,
  is_trial: false,
  is_daily: false,
  days_left: 3,
  end_date: '2026-11-08T12:00:00Z',
  tariff_id: 7,
  requires_tariff_selection: false,
};

function renderBar(sub: typeof subscription | null = subscription) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<RenewBar subscription={sub} today="2026-11-05" />} />
        <Route path="/subscriptions/:id/renew" element={<div>renew-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

it('offers renewal three days before the end', () => {
  renderBar();

  expect(screen.getByText(/renewBar\.daysLeft/).textContent).toContain('3');
  fireEvent.click(screen.getByRole('link', { name: 'renewBar.renew' }));
  expect(screen.getByText('renew-page')).toBeTruthy();
});

it('the renew button pulses like the copy-link button', () => {
  renderBar();

  expect(screen.getByRole('link', { name: 'renewBar.renew' }).className).toContain('cta-pulse');
});

it('hides until tomorrow after the cross', () => {
  renderBar();

  fireEvent.click(screen.getByRole('button', { name: 'renewBar.hideUntilTomorrow' }));
  expect(screen.queryByRole('link', { name: 'renewBar.renew' })).toBeNull();

  cleanup();
  renderBar();
  expect(screen.queryByRole('link', { name: 'renewBar.renew' })).toBeNull();
});

it('renders nothing far from the end', () => {
  renderBar({ ...subscription, days_left: 10 });

  expect(screen.queryByRole('link', { name: 'renewBar.renew' })).toBeNull();
});

// Подпись кнопки — та же, что у главной кнопки в карточке срока на странице подписки.
it.each([
  ['a trial', { is_trial: true, tariff_id: null }, 'renewBar.chooseTariff'],
  [
    'a legacy subscription',
    { tariff_id: null, requires_tariff_selection: true },
    'renewBar.moveToTariff',
  ],
])('names the action for %s like the subscription page does', (_name, over, label) => {
  renderBar({ ...subscription, ...over } as unknown as typeof subscription);

  expect(screen.getByRole('link', { name: label })).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'renewBar.renew' })).toBeNull();
});
