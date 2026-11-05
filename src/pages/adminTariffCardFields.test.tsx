// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PlatformProvider } from '@/platform/PlatformProvider';
import ru from '@/locales/ru.json';
import AdminTariffCreate from './AdminTariffCreate';

function translate(key: string): string {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], ru);
  return typeof value === 'string' ? value : key;
}
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: translate, i18n: { language: 'ru' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
const requests = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));
const stored = {
  id: 7,
  name: 'Семейный',
  description: 'Для бота',
  tagline: 'Для всей семьи',
  speed_limit_mbps: 500,
  has_premium_servers: true,
  device_limit: 3,
  period_prices: [{ days: 30, price_kopeks: 30000 }],
};
vi.mock('@/api/tariffs', () => ({
  tariffsApi: {
    getAvailableServers: async () => [],
    getAvailableExternalSquads: async () => [],
    getAvailablePromoGroups: async () => [],
    getTariff: async () => stored,
    createTariff: requests.create,
    updateTariff: requests.update,
  },
}));
beforeEach(() => {
  requests.create.mockResolvedValue({ id: 8 });
  requests.update.mockResolvedValue(stored);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function mount(edit = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <PlatformProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[edit ? '/admin/tariffs/7/edit' : '/admin/tariffs/create']}>
          <Routes>
            <Route path="/admin/tariffs/:id/edit" element={<AdminTariffCreate />} />
            <Route path="/admin/tariffs/create" element={<AdminTariffCreate />} />
            <Route path="/admin/tariffs" element={<output>Saved</output>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </PlatformProvider>,
  );
}
async function fields() {
  return {
    tagline: await screen.findByLabelText<HTMLInputElement>('Строка под названием'),
    speed: screen.getByLabelText<HTMLInputElement>('Выделенная скорость, Мбит/с'),
    premium: screen.getByRole('switch', { name: 'Премиум-серверы' }),
  };
}
const save = () =>
  fireEvent.click(screen.getByRole('button', { name: translate('admin.tariffs.saveButton') }));

it('loads detail card fields into the edit form', async () => {
  mount();
  const { tagline, speed, premium } = await fields();
  expect(tagline.value).toBe('Для всей семьи');
  expect(tagline.maxLength).toBe(160);
  expect(speed.value).toBe('500');
  expect(speed.min).toBe('1');
  expect(speed.max).toBe('100000');
  expect(premium.getAttribute('aria-checked')).toBe('true');
  expect(screen.getByText('Для кого тариф: показывается в кабинете вместо описания')).toBeTruthy();
});

it('clearing tagline and speed sends explicit nulls in PUT and can disable premium', async () => {
  mount();
  const { tagline, speed, premium } = await fields();
  fireEvent.change(tagline, { target: { value: '' } });
  fireEvent.change(speed, { target: { value: '' } });
  fireEvent.click(premium);
  save();
  await waitFor(() =>
    expect(requests.update).toHaveBeenCalledExactlyOnceWith(
      7,
      expect.objectContaining({
        tagline: null,
        speed_limit_mbps: null,
        has_premium_servers: false,
      }),
    ),
  );
  expect(requests.create).not.toHaveBeenCalled();
});

it('saving unchanged edit fields preserves all three values', async () => {
  mount();
  await fields();
  save();
  await waitFor(() =>
    expect(requests.update).toHaveBeenCalledExactlyOnceWith(
      7,
      expect.objectContaining({
        tagline: 'Для всей семьи',
        speed_limit_mbps: 500,
        has_premium_servers: true,
      }),
    ),
  );
});

it('creating a tariff sends the card fields in POST', async () => {
  mount(false);
  fireEvent.click(screen.getByText(translate('admin.tariffs.periodTariff')));
  const { tagline, speed, premium } = await fields();
  expect(premium.getAttribute('aria-checked')).toBe('false');
  fireEvent.change(screen.getByLabelText(/Название тарифа/), { target: { value: 'Роскошный' } });
  fireEvent.change(tagline, { target: { value: '  Игры, 4K и большие файлы  ' } });
  fireEvent.change(speed, { target: { value: '500' } });
  fireEvent.click(premium);
  fireEvent.click(screen.getByText(translate('admin.tariffs.tabPeriods')));
  fireEvent.click(screen.getByText(translate('admin.tariffs.addButton')));
  save();
  await waitFor(() =>
    expect(requests.create).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        tagline: 'Игры, 4K и большие файлы',
        speed_limit_mbps: 500,
        has_premium_servers: true,
      }),
      expect.anything(),
    ),
  );
  expect(requests.update).not.toHaveBeenCalled();
});
