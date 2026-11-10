// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DeviceSlotsPanel } from './DeviceSlotsPanel';

// Раздел «Устройства» на странице подписки: те же слоты, что на главной, но
// нажатие на устройство не уводит, а открывает его тут же — переименовать или
// отключить. Сюда же переехали «Добавить слот» и «Уменьшить».

const api = vi.hoisted(() => ({
  getDevices: vi.fn(),
  deleteDevice: vi.fn(),
  renameDevice: vi.fn(),
  deleteAllDevices: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && typeof opts === 'object' ? `${key} ${Object.values(opts).join(' ')}` : key,
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('@/api/subscription', () => ({ subscriptionApi: api }));
vi.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ isDark: true }) }));
vi.mock('@/platform', () => ({
  useHaptic: () => ({ impact: vi.fn(), notification: vi.fn() }),
  usePlatform: () => ({ haptic: { impact: vi.fn(), notification: vi.fn() } }),
}));
vi.mock('@/platform/hooks/useNativeDialog', () => ({
  useDestructiveConfirm: () => api.confirm,
}));

const devices = [
  {
    hwid: 'HW-INCY',
    platform: 'Android',
    device_model: 'Xiaomi 25102PCBEG',
    app: 'INCY',
    device_name: 'POCO F8 Ultra',
    created_at: '2026-09-12T10:00:00Z',
  },
  {
    hwid: 'HW-HAPP',
    platform: 'Android',
    device_model: '25102PCBEG',
    app: 'Happ',
    device_name: 'POCO F8 Ultra',
    created_at: '2026-10-01T10:00:00Z',
  },
];

function renderPanel(props: Partial<Parameters<typeof DeviceSlotsPanel>[0]> = {}) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <DeviceSlotsPanel subscriptionId={42} deviceLimit={3} {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getDevices.mockResolvedValue({ devices, total: 2, device_limit: 3 });
  api.deleteDevice.mockResolvedValue({});
  api.renameDevice.mockResolvedValue({});
  api.confirm.mockResolvedValue(true);
});
afterEach(cleanup);

it('draws the slots with the app and the phone name', async () => {
  renderPanel();

  expect(await screen.findByText('INCY')).toBeTruthy();
  expect(screen.getByText('Happ')).toBeTruthy();
  expect(screen.getAllByText('POCO F8 Ultra')).toHaveLength(2);
  expect(screen.getAllByText('dashboard.slots.free')).toHaveLength(1);
  const note = screen.getByText(/dashboard\.slots\.multiApp/);
  expect(note.parentElement?.className).toContain('border-info/40');
  expect(note.parentElement?.className).toContain('bg-info/10');
  for (const app of ['INCY', 'Happ']) {
    expect(screen.getByText(app).closest('button')?.style.border).toContain('--color-info');
  }
});

it('opens a device in place and disconnects it after confirmation', async () => {
  renderPanel();

  fireEvent.click(await screen.findByText('Happ'));
  expect(screen.getByText('HW-HAPP')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'subscription.devicesSection.disconnect' }));

  await waitFor(() => expect(api.deleteDevice).toHaveBeenCalledWith('HW-HAPP', 42));
  expect(api.confirm).toHaveBeenCalled();
});

it('does not disconnect when the confirmation is declined', async () => {
  api.confirm.mockResolvedValue(false);
  renderPanel();

  fireEvent.click(await screen.findByText('INCY'));
  fireEvent.click(screen.getByRole('button', { name: 'subscription.devicesSection.disconnect' }));

  await waitFor(() => expect(api.confirm).toHaveBeenCalled());
  expect(api.deleteDevice).not.toHaveBeenCalled();
});

it('renames the opened device', async () => {
  renderPanel();

  fireEvent.click(await screen.findByText('INCY'));
  fireEvent.click(screen.getByRole('button', { name: 'subscription.devicesSection.rename' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Рабочий' } });
  fireEvent.click(screen.getByRole('button', { name: 'subscription.renameDeviceSave' }));

  await waitFor(() => expect(api.renameDevice).toHaveBeenCalledWith('HW-INCY', 'Рабочий', 42));
});

it('offers add and reduce only when the page passes them', async () => {
  const onAddSlot = vi.fn();
  const onReduce = vi.fn();
  renderPanel({ onAddSlot, onReduce });

  fireEvent.click(
    await screen.findByRole('button', { name: /subscription\.devicesSection\.addSlot/ }),
  );
  fireEvent.click(screen.getByRole('button', { name: /subscription\.devicesSection\.reduce/ }));
  expect(onAddSlot).toHaveBeenCalled();
  expect(onReduce).toHaveBeenCalled();

  cleanup();
  renderPanel();
  await screen.findByText('INCY');
  expect(
    screen.queryByRole('button', { name: /subscription\.devicesSection\.addSlot/ }),
  ).toBeNull();
});

it('disconnects all devices only after confirmation', async () => {
  api.deleteAllDevices.mockResolvedValue({});
  renderPanel();

  api.confirm.mockResolvedValueOnce(false);
  fireEvent.click(
    await screen.findByRole('button', { name: 'subscription.devicesSection.disconnectAll' }),
  );
  await waitFor(() => expect(api.confirm).toHaveBeenCalledTimes(1));
  expect(api.deleteAllDevices).not.toHaveBeenCalled();

  fireEvent.click(
    screen.getByRole('button', { name: 'subscription.devicesSection.disconnectAll' }),
  );
  await waitFor(() => expect(api.deleteAllDevices).toHaveBeenCalledWith(42));
});
