// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import DeviceSlots from './DeviceSlots';

// Слот на главной = приложение на устройстве. Один телефон с подпиской и в
// INCY, и в Happ — два слота, и человеку это должно быть видно без поддержки.

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

const dev = (hwid: string, platform: string, device_model: string, app: string | null) => ({
  hwid,
  platform,
  device_model,
  app,
  created_at: null,
});

function renderSlots(deviceLimit: number, devices: ReturnType<typeof dev>[]) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="/"
          element={
            <DeviceSlots
              subscription={{ id: 9, device_limit: deviceLimit, subscription_url: 'https://x' }}
              devices={devices}
            />
          }
        />
        <Route path="/connection" element={<div>connection-page</div>} />
        <Route path="/subscriptions/:id" element={<div>subscription-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(cleanup);

it('shows the app on every occupied slot and the free ones', () => {
  renderSlots(3, [
    dev('a', 'Android', 'Xiaomi 14', 'INCY'),
    dev('b', 'iOS', 'iPhone 15', 'koala-clash'),
  ]);

  expect(screen.getByText('INCY')).toBeTruthy();
  expect(screen.getByText('Koala Clash')).toBeTruthy();
  expect(screen.getAllByText('dashboard.slots.free')).toHaveLength(1);
});

it('explains a phone that takes two slots through two apps', () => {
  renderSlots(3, [
    dev('a', 'Android', 'Xiaomi 14', 'INCY'),
    dev('b', 'Android', 'Xiaomi 14', 'Happ'),
  ]);

  const note = screen.getByText(/dashboard\.slots\.multiApp/);
  expect(note.textContent).toContain('Xiaomi 14');
  expect(note.textContent).toContain('INCY');
  expect(note.textContent).toContain('Happ');
});

it('connects a new device while a slot is free', () => {
  renderSlots(3, [dev('a', 'iOS', 'iPhone 15', 'Happ')]);

  fireEvent.click(screen.getByRole('button', { name: 'dashboard.connectDevice' }));
  expect(screen.getByText('connection-page')).toBeTruthy();
});

it('leads to device management instead of a dead button when every slot is taken', () => {
  renderSlots(2, [dev('a', 'iOS', 'iPhone 15', 'Happ'), dev('b', 'Windows', 'PC', 'INCY')]);

  expect(screen.queryByRole('button', { name: 'dashboard.connectDevice' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'dashboard.slots.freeUpOrAdd' }));
  expect(screen.getByText('subscription-page')).toBeTruthy();
});

it('draws one wide row for a single slot', () => {
  renderSlots(1, [dev('a', 'iOS', 'iPhone 15', 'Happ')]);

  expect(screen.getByText('Happ')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'dashboard.slots.manage' }));
  expect(screen.getByText('subscription-page')).toBeTruthy();
});

it('shows only real devices when the tariff has no limit', () => {
  renderSlots(0, [dev('a', 'iOS', 'iPhone 15', 'Happ')]);

  expect(screen.getByText('Happ')).toBeTruthy();
  expect(screen.queryByText('dashboard.slots.free')).toBeNull();
});

// Скриншот владельца 04.11: INCY прислал «Xiaomi 25102PCBEG», Happ — «25102PCBEG»;
// ячейки назывались по-разному, а предупреждение про два слота не появилось.
it('names both slots of one phone the same and warns about the second app', () => {
  renderSlots(3, [
    dev('a', 'Android', 'Xiaomi 25102PCBEG', 'INCY'),
    dev('b', 'Android', '25102PCBEG', 'Happ'),
  ]);

  expect(screen.getAllByText('Xiaomi 25102PCBEG')).toHaveLength(2);
  expect(screen.queryByText('25102PCBEG')).toBeNull();
  expect(screen.getByText(/dashboard\.slots\.multiApp/).textContent).toContain('Xiaomi 25102PCBEG');
});

it('does not print the slot legend: it read as noise above the grid', () => {
  renderSlots(3, [dev('a', 'iOS', 'iPhone 15', 'Happ')]);

  expect(screen.queryByText('dashboard.slots.legend')).toBeNull();
});
