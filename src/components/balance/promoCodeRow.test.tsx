// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { afterEach, expect, it, vi } from 'vitest';
import { balanceApi } from '@/api/balance';
import ru from '@/locales/ru.json';
import { PromoCodeRow } from './PromoCodeRow';

vi.mock('@/platform', () => ({ usePlatform: () => ({ haptic: { impact: vi.fn() } }) }));
vi.mock('@/api/balance', () => ({ balanceApi: { activatePromocode: vi.fn() } }));
vi.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ({ formatAmount: String, currencySymbol: '₽' }),
}));
vi.mock('@/store/auth', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector({ refreshUser: vi.fn() }),
}));
const translations = createInstance();
await translations.init({ lng: 'ru', resources: { ru: { translation: ru } }, initAsync: false });
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPromo(client = new QueryClient()) {
  return render(
    <I18nextProvider i18n={translations}>
      <QueryClientProvider client={client}>
        <PromoCodeRow />
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

it('раскрывает нынешнюю форму промокода по нажатию строки', () => {
  renderPromo();
  const toggle = screen.getByRole('button', { name: /Есть промокод/ });
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByRole('textbox')).toBeNull();
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByPlaceholderText('Введите промокод')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Активировать' })).toBeTruthy();
});

it('после выбора подписки сохраняет успех в открытой форме и обновляет все связанные данные', async () => {
  vi.mocked(balanceApi.activatePromocode)
    .mockResolvedValueOnce({
      success: false,
      error: 'select_subscription',
      code: 'FREE3',
      eligible_subscriptions: [{ id: 42, tariff_name: 'Уверенный стандарт', days_left: 23 }],
    })
    .mockResolvedValueOnce({ success: true, bonus_description: 'Добавлено три дня' });
  const client = new QueryClient();
  const keys = [
    ['balance'],
    ['subscription'],
    ['subscription', 42],
    ['renewal-options', 42],
    ['transactions', 2],
    ['purchase-options'],
    ['subscriptions-list'],
  ];
  for (const key of keys) client.setQueryData(key, {});
  renderPromo(client);
  const toggle = screen.getByRole('button', { name: /Есть промокод/ });
  fireEvent.click(toggle);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: ' FREE3 ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Активировать' }));
  fireEvent.click(await screen.findByRole('button', { name: /Уверенный стандарт/ }));
  expect(await screen.findByText('Добавлено три дня')).toBeTruthy();
  await waitFor(() => {
    for (const key of keys) expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  });
  expect(balanceApi.activatePromocode).toHaveBeenNthCalledWith(1, 'FREE3', undefined);
  expect(balanceApi.activatePromocode).toHaveBeenNthCalledWith(2, 'FREE3', 42);
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');
  client.clear();
});

it('показывает локализованную ошибку активации', async () => {
  vi.mocked(balanceApi.activatePromocode).mockRejectedValue({
    response: { data: { detail: { code: 'already_used_by_user' } } },
  });
  renderPromo();
  fireEvent.click(screen.getByRole('button', { name: /Есть промокод/ }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'USED' } });
  fireEvent.click(screen.getByRole('button', { name: 'Активировать' }));
  expect(await screen.findByText(ru.balance.promocode.errors.already_used_by_user)).toBeTruthy();
});
