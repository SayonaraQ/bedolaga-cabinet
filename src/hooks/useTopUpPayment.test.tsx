// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const openLink = vi.fn();
const notification = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
  }),
}));
vi.mock('@/platform', () => ({
  usePlatform: () => ({ openLink, platform: 'telegram' }),
  useHaptic: () => ({ notification }),
}));
vi.mock('../api/balance', () => ({
  balanceApi: { createTopUp: vi.fn() },
}));
vi.mock('../utils/openPaymentUrl', () => ({ openPaymentUrl: vi.fn() }));

import { balanceApi } from '../api/balance';
import type { PaymentMethod } from '../types';
import { openPaymentUrl } from '../utils/openPaymentUrl';
import { loadTopUpPendingInfo } from '../utils/topUpStorage';
import { useTopUpPayment } from './useTopUpPayment';

const method: PaymentMethod = {
  id: 'yookassa',
  name: 'ЮKassa',
  description: null,
  min_amount_kopeks: 1000,
  max_amount_kopeks: 1000000,
  is_available: true,
  open_url_direct: false,
};
const payment = {
  payment_id: 'payment-1',
  payment_url: 'https://example.com/pay',
  amount_kopeks: 30000,
  amount_rubles: 300,
  status: 'pending',
  expires_at: null,
};

let testTime = Date.now();
beforeEach(() => {
  // Separate user attempts by more than the real payment rate-limit window.
  testTime += 31000;
  vi.spyOn(Date, 'now').mockReturnValue(testTime);
  sessionStorage.clear();
  vi.mocked(balanceApi.createTopUp).mockResolvedValue(payment);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

function renderPayment(paymentMethod: PaymentMethod | undefined = method) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useTopUpPayment(paymentMethod), { wrapper });
}

it('создаёт один счёт с выбранным вариантом и сохраняет ссылку и данные платежа', async () => {
  const { result } = renderPayment();

  act(() => result.current.pay(30000, 'sbp'));

  await waitFor(() => expect(result.current.paymentUrl).toBe(payment.payment_url));
  expect(balanceApi.createTopUp).toHaveBeenCalledTimes(1);
  expect(balanceApi.createTopUp).toHaveBeenCalledWith(30000, 'yookassa', 'sbp');
  expect(loadTopUpPendingInfo()).toEqual({
    amount_kopeks: 30000,
    method_id: 'yookassa',
    method_name: 'ЮKassa',
    payment_id: 'payment-1',
    created_at: testTime,
  });
});

it('сохраняет QR и ссылку даже при включённом автоматическом переходе', async () => {
  vi.mocked(balanceApi.createTopUp).mockResolvedValue({
    ...payment,
    qr_payload: 'https://qr.nspk.ru/AS1',
  });
  const { result } = renderPayment({ ...method, open_url_direct: true });

  act(() => result.current.pay(30000));

  await waitFor(() => expect(result.current.qrPayload).toBe('https://qr.nspk.ru/AS1'));
  expect(result.current.paymentUrl).toBe(payment.payment_url);
  expect(openPaymentUrl).not.toHaveBeenCalled();
});

it('сохраняет данные до автоматического открытия обычной ссылки', async () => {
  vi.mocked(openPaymentUrl).mockImplementation(() => {
    expect(loadTopUpPendingInfo()?.payment_id).toBe(payment.payment_id);
  });
  const { result } = renderPayment({ ...method, open_url_direct: true });

  act(() => result.current.pay(30000));

  await waitFor(() =>
    expect(openPaymentUrl).toHaveBeenCalledWith(payment.payment_url, 'telegram', openLink),
  );
  expect(result.current.paymentUrl).toBeNull();
});

it.each(['https://t.me/provider', 'http://t.me/provider', 'tg://resolve?domain=provider'])(
  'оставляет Telegram-ссылку %s в панели оплаты',
  async (paymentUrl) => {
    vi.mocked(balanceApi.createTopUp).mockResolvedValue({ ...payment, payment_url: paymentUrl });
    const { result } = renderPayment({ ...method, open_url_direct: true });

    act(() => result.current.pay(30000));

    await waitFor(() => expect(result.current.paymentUrl).toBe(paymentUrl));
    expect(openPaymentUrl).not.toHaveBeenCalled();
  },
);

it('передаёт email для Antilopay без пробелов', async () => {
  const { result } = renderPayment({ ...method, id: 'antilopay' });

  act(() => result.current.pay(30000, null, { email: ' user@example.com ' }));

  await waitFor(() => expect(result.current.paymentUrl).toBe(payment.payment_url));
  expect(balanceApi.createTopUp).toHaveBeenCalledWith(
    30000,
    'antilopay',
    undefined,
    'user@example.com',
  );
});

it('показывает ошибку API и завершает ожидание', async () => {
  vi.mocked(balanceApi.createTopUp).mockRejectedValue(new Error('Request failed'));
  const { result } = renderPayment();

  act(() => result.current.pay(30000));

  await waitFor(() => expect(result.current.error).toBeTruthy());
  expect(result.current.isPending).toBe(false);
});

it('предлагает оплатить в боте для ещё не реализованного способа', async () => {
  vi.mocked(balanceApi.createTopUp).mockRejectedValue({
    isAxiosError: true,
    response: { data: { detail: 'Payment not yet implemented' } },
  });
  const { result } = renderPayment();

  act(() => result.current.pay(30000));

  await waitFor(() => expect(result.current.error).toBe('balance.useBot'));
});

it('ограничивает создание счетов тремя запросами за 30 секунд', async () => {
  const { result } = renderPayment();

  for (let attempt = 1; attempt <= 3; attempt++) {
    act(() => result.current.pay(30000));
    await waitFor(() => expect(balanceApi.createTopUp).toHaveBeenCalledTimes(attempt));
    await waitFor(() => expect(result.current.isPending).toBe(false));
  }
  act(() => result.current.pay(30000));

  expect(result.current.error).toBe('balance.errors.rateLimit');
  expect(balanceApi.createTopUp).toHaveBeenCalledTimes(3);
});

it('сбрасывает ссылку, QR и ошибку', async () => {
  vi.mocked(balanceApi.createTopUp).mockResolvedValue({ ...payment, qr_payload: 'QR payload' });
  const { result } = renderPayment();
  act(() => result.current.pay(30000));
  await waitFor(() => expect(result.current.qrPayload).toBe('QR payload'));
  act(() => result.current.setError('Validation error'));

  act(() => result.current.reset());

  expect(result.current.error).toBeNull();
  expect(result.current.paymentUrl).toBeNull();
  expect(result.current.qrPayload).toBeNull();
});
