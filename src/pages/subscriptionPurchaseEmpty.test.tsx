// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { ToastProvider } from '@/components/Toast';
import { PlatformProvider } from '@/platform/PlatformProvider';

/**
 * Пустая витрина — не сбой, а настройка: тарифы не привязаны к промогруппе
 * человека (сентябрь 2026, 510 аккаунтов видели пустой магазин). «Повторить»
 * тут ничего не меняет, поэтому главное действие — написать в поддержку.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ru', changeLanguage: () => Promise.resolve() },
  }),
  Trans: ({ children }: { children?: unknown }) => children ?? null,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const getPurchaseOptions = vi.fn();
vi.mock('@/api/subscription', () => ({
  subscriptionApi: {
    getSubscription: async () => ({ has_subscription: false, subscription: null }),
    getPurchaseOptions: (...a: unknown[]) => getPurchaseOptions(...a),
    getSubscriptions: async () => ({ subscriptions: [], multi_tariff_enabled: true }),
  },
}));
vi.mock('@/api/branding', () => ({
  brandingApi: { getLiteModeEnabled: async () => ({ enabled: false }) },
}));
vi.mock('@/hooks/usePromoDiscount', () => ({
  usePromoDiscount: () => ({
    applyPromoDiscount: (price: number, original?: number) => ({ price, original, percent: null }),
  }),
}));
vi.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ({ formatAmount: (v: number) => String(v), currencySymbol: '₽' }),
}));

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

import SubscriptionPurchase from './SubscriptionPurchase';

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PlatformProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={['/subscription/purchase']}>
            <Routes>
              <Route path="/subscription/purchase" element={<SubscriptionPurchase />} />
              <Route path="/support" element={<div>support-page</div>} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </PlatformProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  getPurchaseOptions.mockResolvedValue({ sales_mode: 'tariffs', tariffs: [], balance_kopeks: 0 });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

it('explains an empty store and leads to support', async () => {
  renderPage();

  expect(await screen.findByText('subscription.noOptionsTitle')).toBeTruthy();
  expect(screen.getByText('subscription.noOptionsHint')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'subscription.noOptionsContactSupport' }));

  expect(await screen.findByText('support-page')).toBeTruthy();
});

it('keeps a way to reload the options', async () => {
  renderPage();

  fireEvent.click(await screen.findByRole('button', { name: 'common.retry' }));

  expect(getPurchaseOptions).toHaveBeenCalledTimes(2);
});
