// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { SwitchTariffSheet } from './SwitchTariffSheet';

/**
 * Managed-подписка в открытом grace по трафику тариф не меняет: бот отвечает
 * кодом grace_switch_unavailable. Окно смены объясняет это своим заголовком и
 * ведёт в докупку трафика вместо бесполезного «Повторить».
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('../../../hooks/useCurrency', () => ({
  useCurrency: () => ({ formatAmount: (value: number) => String(value), currencySymbol: '₽' }),
}));
vi.mock('../../../hooks/usePromoDiscount', () => ({
  usePromoDiscount: () => ({ applyPromoDiscount: (value: number) => value }),
}));

const preview = { code: 'grace_switch_unavailable', status: 400 };

function rejection(code: string, status: number) {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: 'Bad Request',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { detail: { code, message: 'server message' } },
  });
}

vi.mock('../../../api/subscription', () => ({
  subscriptionApi: {
    previewTariffSwitch: () => Promise.reject(rejection(preview.code, preview.status)),
  },
}));

HTMLElement.prototype.scrollIntoView = () => {};
afterEach(() => {
  cleanup();
  preview.code = 'grace_switch_unavailable';
});

function Where() {
  const location = useLocation();
  return <p data-testid="where">{`${location.pathname}${location.hash}`}</p>;
}

function renderSheet(subscriptionId: number | undefined) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/subscription/purchase']}>
        <Routes>
          <Route
            path="/subscription/purchase"
            element={
              <SwitchTariffSheet
                open
                tariffId={9}
                subscriptionId={subscriptionId}
                tariffs={[]}
                onClose={() => {}}
                onExpiredFallback={() => {}}
              />
            }
          />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

it('explains the grace refusal and offers a traffic top-up instead of a retry', async () => {
  renderSheet(42);

  expect(await screen.findByText('subscription.switchTariff.graceUnavailableTitle')).toBeTruthy();
  expect(screen.queryByText('subscription.switchTariff.previewError')).toBeNull();
  expect(screen.queryByText('common.retry')).toBeNull();

  fireEvent.click(screen.getByText('subscription.switchTariff.buyTraffic'));
  expect(screen.getByTestId('where').textContent).toBe('/subscriptions/42#traffic');
});

it('falls back to the single-subscription page without a subscription id', async () => {
  renderSheet(undefined);

  fireEvent.click(await screen.findByText('subscription.switchTariff.buyTraffic'));
  expect(screen.getByTestId('where').textContent).toBe('/subscription#traffic');
});

it('keeps the generic error and retry for other refusals', async () => {
  preview.code = 'something_else';
  renderSheet(42);

  expect(await screen.findByText('subscription.switchTariff.previewError')).toBeTruthy();
  expect(screen.getByText('common.retry')).toBeTruthy();
  expect(screen.queryByText('subscription.switchTariff.buyTraffic')).toBeNull();
});
