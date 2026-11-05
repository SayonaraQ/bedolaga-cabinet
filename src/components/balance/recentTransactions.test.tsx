// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { afterEach, expect, it, vi } from 'vitest';
import ru from '@/locales/ru.json';
import type { PaginatedResponse, Transaction } from '@/types';
import { RecentTransactions } from './RecentTransactions';

vi.mock('@/platform', () => ({ usePlatform: () => ({ haptic: { impact: vi.fn() } }) }));
const translations = createInstance();
await translations.init({ lng: 'ru', resources: { ru: { translation: ru } }, initAsync: false });
const transactions: PaginatedResponse<Transaction> = {
  items: Array.from({ length: 5 }, (_, index) => ({
    id: index + 1,
    type: index === 1 ? 'SUBSCRIPTION_PAYMENT' : 'DEPOSIT',
    amount_kopeks: index === 1 ? -30000 : 10000,
    amount_rubles: index === 1 ? -300 : 100,
    description: `Операция ${index + 1}`,
    payment_method: 'yookassa',
    is_completed: true,
    created_at: '2026-11-05T12:00:00Z',
    completed_at: null,
  })),
  total: 25,
  page: 1,
  per_page: 20,
  pages: 2,
};
afterEach(cleanup);
function renderHistory(data = transactions, onPageChange = vi.fn()) {
  return render(
    <I18nextProvider i18n={translations}>
      <QueryClientProvider client={new QueryClient()}>
        <RecentTransactions transactions={data} isLoading={false} onPageChange={onPageChange} />
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

it('показывает три операции и раскрывает полный список с пагинацией', () => {
  const onPageChange = vi.fn();
  renderHistory(transactions, onPageChange);
  expect(screen.getAllByText(/^Операция \d/)).toHaveLength(3);
  expect(screen.queryByRole('button', { name: 'Далее' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Вся история' }));
  expect(screen.getAllByText(/^Операция \d/)).toHaveLength(5);
  fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
  expect(onPageChange).toHaveBeenCalledWith(2);
  expect(screen.getByRole('button', { name: 'Свернуть' })).toBeTruthy();
});

it('не показывает блок без операций', () => {
  const { container } = renderHistory({ ...transactions, items: [], total: 0, pages: 0 });
  expect(container.innerHTML).toBe('');
});

it('показывает списание обычным цветом без обрезания суммы в обоих режимах', () => {
  renderHistory();
  for (let mode = 0; mode < 2; mode++) {
    const amount = screen.getByText(/-300[,.]00\s*₽/);
    expect(amount.className).toContain('text-dark-100');
    expect(amount.className).not.toContain('text-error');
    expect(amount.className).not.toContain('truncate');
    if (mode === 0) fireEvent.click(screen.getByRole('button', { name: 'Вся история' }));
  }
});
