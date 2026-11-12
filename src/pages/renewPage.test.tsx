// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, CanceledError } from 'axios';
import { PlatformProvider } from '@/platform/PlatformProvider';
import ruLocale from '@/locales/ru.json';
import type { PaymentMethod, RenewalOption, Subscription } from '@/types';
import { tariffSelectionPath } from '@/utils/legacySubscription';
import * as topUpPayment from '@/hooks/useTopUpPayment';
import RenewSubscription from './RenewSubscription';

const api = vi.hoisted(() => ({
  renew: vi.fn(),
  topUp: vi.fn(),
  methods: vi.fn(),
  purchase: vi.fn(),
  subscription: vi.fn(),
  options: vi.fn(),
}));
const state = {
  balance: 100000,
  subscription: {} as Subscription,
  options: [] as RenewalOption[],
  methods: [] as PaymentMethod[],
  targetCurrency: 'RUB',
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown, options?: Record<string, unknown>) => {
      const opts = (typeof fallback === 'object' && fallback !== null ? fallback : options) as
        | Record<string, unknown>
        | undefined;
      const plural =
        opts?.count === undefined
          ? key
          : `${key}_${new Intl.PluralRules('ru').select(Number(opts.count))}`;
      const read = (path: string) =>
        path
          .split('.')
          .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], ruLocale);
      const value = read(plural) ?? read(key);
      const template =
        typeof value === 'string' ? value : typeof fallback === 'string' ? fallback : key;
      return template.replace(/{{(\w+)}}/g, (_match, name) => String(opts?.[name] ?? ''));
    },
    i18n: { language: 'ru', changeLanguage: () => Promise.resolve() },
  }),
  Trans: ({ children }: { children?: unknown }) => children ?? null,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('@/api/subscription', () => ({
  subscriptionApi: {
    getSubscription: api.subscription,
    getRenewalOptions: api.options,
    getPurchaseOptions: api.purchase,
    renewSubscription: api.renew,
  },
}));
vi.mock('@/api/balance', () => ({
  balanceApi: { getPaymentMethods: api.methods, createTopUp: api.topUp },
}));
vi.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ({
    formatAmount: (amount: number, decimals = 2) =>
      amount.toLocaleString('ru-RU', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }),
    currencySymbol: '₽',
    targetCurrency: state.targetCurrency,
  }),
}));
vi.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ isDark: true }) }));
vi.mock('@/utils/uiLocale', () => ({ uiLocale: () => 'ru-RU' }));
// Счётчик общего платёжного хука живёт между тестами; лимит проверяется отдельно.
vi.mock('@/utils/rateLimit', () => ({
  checkRateLimit: () => true,
  getRateLimitResetTime: () => 0,
  RATE_LIMIT_KEYS: { PAYMENT: 'payment' },
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

function rejection(status: number, detail: unknown): AxiosError {
  return Object.assign(new AxiosError('Rejected'), { response: { status, data: { detail } } });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-12T12:00:00Z'));
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  state.balance = 100000;
  state.targetCurrency = 'RUB';
  state.subscription = {
    id: 42,
    tariff_id: 1,
    tariff_name: 'Уверенный стандарт',
    end_date: '2026-11-25T03:00:00Z',
    status: 'active',
    is_active: true,
    is_expired: false,
    is_trial: false,
    is_daily: false,
    autopay_enabled: true,
    autopay_days_before: 3,
    autopay_period_days: 30,
  } as Subscription;
  state.options = [30, 60, 90].map((days, index) => ({
    period_days: days,
    price_kopeks: [30000, 58000, 85000][index],
    price_rubles: [300, 580, 850][index],
    discount_percent: 0,
    original_price_kopeks: null,
  }));
  state.methods = [
    {
      id: 'yookassa',
      name: 'ЮKassa',
      description: null,
      min_amount_kopeks: 10000,
      max_amount_kopeks: 10000000,
      is_available: true,
      options: [
        { id: 'card', name: '💳 Карта' },
        { id: 'sbp', name: '🏦 СБП' },
      ],
    },
  ];
  api.subscription.mockImplementation(async () => ({ subscription: state.subscription }));
  api.options.mockImplementation(async () => state.options);
  api.purchase.mockImplementation(async () => ({ balance_kopeks: state.balance }));
  api.methods.mockImplementation(async () => state.methods);
  api.renew.mockRejectedValue(
    rejection(402, { code: 'insufficient_funds', missing_amount: 15000 }),
  );
  api.topUp.mockResolvedValue({
    payment_id: 'payment-1',
    payment_url: 'https://pay.example/payment-1',
    amount_kopeks: 15000,
    amount_rubles: 150,
    status: 'pending',
    expires_at: null,
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function Destination() {
  const location = useLocation();
  return (
    <div data-testid="destination">
      {location.pathname}
      {location.search}
    </div>
  );
}
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 2, retryDelay: 0 } },
  });
  render(
    <QueryClientProvider client={client}>
      <PlatformProvider>
        <MemoryRouter initialEntries={['/subscriptions/42/renew']}>
          <Routes>
            <Route path="/subscriptions/:subscriptionId/renew" element={<RenewSubscription />} />
            <Route path="*" element={<Destination />} />
          </Routes>
        </MemoryRouter>
      </PlatformProvider>
    </QueryClientProvider>,
  );
  return client;
}
async function payButton(amount = 150) {
  return screen.findByRole('button', { name: new RegExp(`^Оплатить ${amount}\\s*₽ через СБП$`) });
}
async function expectTopUp(amount = 15000) {
  await waitFor(() => expect(api.topUp).toHaveBeenCalledTimes(1));
  expect(api.topUp).toHaveBeenCalledWith(amount, 'yookassa', 'sbp');
}

describe('продление в одной карточке', () => {
  it('сразу выбирает месяц и предлагает продление без лишнего нажатия', async () => {
    mount();
    expect(
      (await screen.findByRole('radio', { name: /^1 мес/ })).getAttribute('aria-checked'),
    ).toBe('true');
    expect(await screen.findByRole('button', { name: /^Продлить за 300\s*₽$/ })).toBeTruthy();
  });
  it('пересчитывает дату после смены периода, включая следующий год', async () => {
    mount();
    expect(await screen.findByText('25 декабря')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /^3 мес/ }));
    expect(screen.getByText('23 февраля 2027 г.')).toBeTruthy();
  });
  it('продлевает истёкшую подписку от сегодня и скрывает автоплатёж', async () => {
    Object.assign(state.subscription, {
      end_date: '2026-11-08T03:00:00Z',
      status: 'expired',
      is_expired: true,
      is_active: false,
    });
    mount();
    expect(await screen.findByText('Закончилась 8 ноября')).toBeTruthy();
    expect(screen.getByText('12 декабря')).toBeTruthy();
    expect(screen.queryByText('Автопродление включено')).toBeNull();
  });
  it('показывает экономию длинных периодов без скидки на базовом', async () => {
    mount();
    const monthly = await screen.findByRole('radio', { name: /^1 мес/ });
    expect(within(monthly).queryByText(/^−/)).toBeNull();
    expect(
      within(screen.getByRole('radio', { name: /^2 мес/ })).getByText(/^−20\s*₽$/),
    ).toBeTruthy();
    expect(
      within(screen.getByRole('radio', { name: /^3 мес/ })).getByText(/^−50\s*₽$/),
    ).toBeTruthy();
  });
  it('пишет цену за месяц на каждой плитке, и на первой тоже', async () => {
    mount();
    const monthly = await screen.findByRole('radio', { name: /^1 мес/ });
    // У первой плитки цена за месяц повторяет её цену: строка не пустая.
    expect(within(monthly).getAllByText(/^300\s*₽$/)).toHaveLength(2);
    expect(
      within(screen.getByRole('radio', { name: /^2 мес/ })).getByText(/^290\s*₽$/),
    ).toBeTruthy();
    expect(
      within(screen.getByRole('radio', { name: /^3 мес/ })).getByText(/^283\s*₽$/),
    ).toBeTruthy();
    expect(within(monthly).getByText('/мес')).toBeTruthy();
  });
  it('выгода — ярлыком на углу, а не строкой в плитке', async () => {
    mount();
    const chip = within(await screen.findByRole('radio', { name: /^3 мес/ })).getByText(
      /^−50\s*₽$/,
    );
    expect(chip.className).toContain('absolute');
  });
  it('показывает нехватку один раз, в итогах', async () => {
    state.balance = 15000;
    mount();
    await payButton();
    expect(screen.getAllByText('Не хватает')).toHaveLength(1);
    expect(screen.queryByText(/Недостаточно средств/)).toBeNull();
  });
  it('сначала сохраняет продление и только после 402 создаёт оплату', async () => {
    state.balance = 15000;
    mount();
    fireEvent.click(await payButton());
    await expectTopUp();
    expect(api.renew).toHaveBeenCalledTimes(1);
    expect(api.renew).toHaveBeenCalledWith(30, 42, '2026-11-25T03:00:00Z');
    expect(api.renew.mock.invocationCallOrder[0]).toBeLessThan(
      api.topUp.mock.invocationCallOrder[0],
    );
  });
  it('использует клиентскую нехватку, когда сервер не передал сумму', async () => {
    state.balance = 15000;
    api.renew.mockRejectedValue(rejection(402, { code: 'insufficient_funds' }));
    mount();
    fireEvent.click(await payButton());
    await expectTopUp();
  });
  it('учитывает минимальную сумму пополнения', async () => {
    state.balance = 25000;
    api.renew.mockRejectedValue(
      rejection(402, { code: 'insufficient_funds', missing_amount: 5000 }),
    );
    mount();
    fireEvent.click(await payButton(100));
    expect(
      screen.getByText(/Минимальное пополнение — 100\s*₽, остаток останется на балансе/),
    ).toBeTruthy();
    await expectTopUp(10000);
  });
  it('не создаёт оплату, если продление уже удалось', async () => {
    state.balance = 15000;
    api.renew.mockResolvedValue({});
    mount();
    fireEvent.click(await payButton());
    expect((await screen.findByTestId('destination')).textContent).toBe('/subscriptions/42');
    expect(api.topUp).not.toHaveBeenCalled();
  });
  it.each(['network', 'cancel', 502, 503, 504])(
    'не создаёт оплату при неопределённом результате: %s',
    async (failure) => {
      state.balance = 15000;
      api.renew.mockRejectedValue(
        failure === 'cancel'
          ? new CanceledError()
          : failure === 'network'
            ? new AxiosError('Network Error')
            : rejection(Number(failure), {}),
      );
      mount();
      fireEvent.click(await payButton());
      expect(await screen.findByText(ruLocale.subscription.purchaseOutcomeUnknown)).toBeTruthy();
      expect(api.topUp).not.toHaveBeenCalled();
      expect(api.renew).toHaveBeenCalledTimes(1);
    },
  );
  it('защищает от двух синхронных нажатий', async () => {
    state.balance = 15000;
    mount();
    const button = await payButton();
    act(() => {
      button.click();
      button.click();
    });
    await expectTopUp();
    expect(api.renew).toHaveBeenCalledTimes(1);
  });
  it('сохраняет период и панель, пока создаётся платёж с QR', async () => {
    state.balance = 15000;
    let completeTopUp: () => void = () => {
      throw new Error('Оплата ещё не началась');
    };
    api.topUp.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          completeTopUp = () =>
            resolve({
              payment_id: 'delayed-qr',
              payment_url: 'https://pay.example/delayed-qr',
              qr_payload: 'bank://delayed-qr',
              amount_kopeks: 15000,
              amount_rubles: 150,
              status: 'pending',
              expires_at: null,
            });
        }),
    );
    mount();
    fireEvent.click(await payButton());
    await waitFor(() => expect(api.topUp).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      for (const radio of screen.getAllByRole('radio')) {
        expect(radio.hasAttribute('disabled')).toBe(true);
      }
    });
    fireEvent.click(screen.getByRole('radio', { name: /^3 мес/ }));
    expect(screen.getByRole('radio', { name: /^1 мес/ }).getAttribute('aria-checked')).toBe('true');
    await act(async () => completeTopUp());
    expect(await screen.findByTestId('topup-qr')).toBeTruthy();
    expect(screen.getByText('https://pay.example/delayed-qr')).toBeTruthy();
    await waitFor(() => {
      for (const radio of screen.getAllByRole('radio')) {
        expect(radio.hasAttribute('disabled')).toBe(false);
      }
    });
    expect(api.topUp).toHaveBeenCalledTimes(1);
    expect(api.renew).toHaveBeenCalledTimes(1);
  });
  it('показывает дату и сумму покрытого автоплатежа независимо от выбора', async () => {
    mount();
    expect(await screen.findByText(/22 ноября спишем 300\s*₽ с баланса/)).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /^3 мес/ }));
    expect(screen.getByText(/22 ноября спишем 300\s*₽ с баланса/)).toBeTruthy();
  });
  it('предлагает включить выключенный автоплатёж в настройках подписки', async () => {
    state.subscription.autopay_enabled = false;
    mount();
    expect(await screen.findByText('Автопродление выключено')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Включить' }).getAttribute('href')).toBe(
      '/subscriptions/42',
    );
  });
  it('ссылается на смену тарифа для этой подписки', async () => {
    mount();
    expect(
      (
        await screen.findByRole('link', {
          name: new RegExp(ruLocale.subscription.switchTariff.title),
        })
      ).getAttribute('href'),
    ).toBe(tariffSelectionPath(42));
  });
  it('скрывает автоплатёж при прошедшем сроке даже со старым статусом active', async () => {
    state.subscription.end_date = '2026-11-08T03:00:00Z';
    mount();
    await screen.findByRole('radio', { name: /^1 мес/ });
    expect(screen.queryByText('Автопродление включено')).toBeNull();
    expect(screen.getByText('12 декабря')).toBeTruthy();
  });
  it('после 402 на обычном продлении обновляет баланс и показывает встроенную оплату', async () => {
    api.renew.mockImplementation(async () => {
      state.balance = 15000;
      throw rejection(402, { code: 'insufficient_funds', missing_amount: 15000 });
    });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /^Продлить за 300\s*₽$/ }));
    expect(await payButton()).toBeTruthy();
    expect(api.purchase.mock.calls.length).toBeGreaterThan(1);
    expect(api.topUp).not.toHaveBeenCalled();
  });
  it('после 402 убирает устаревшую нехватку, когда новый баланс покрывает продление', async () => {
    api.renew.mockImplementation(async () => {
      state.balance = 15000;
      throw rejection(402, { code: 'insufficient_funds', missing_amount: 15000 });
    });
    const client = mount();
    fireEvent.click(await screen.findByRole('button', { name: /^Продлить за 300\s*₽$/ }));
    await payButton();
    state.balance = 100000;
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['purchase-options', 42] });
    });
    expect(await screen.findByRole('button', { name: /^Продлить за 300\s*₽$/ })).toBeTruthy();
    expect(screen.queryByText('Не хватает')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Оплатить/ })).toBeNull();
    expect(api.topUp).not.toHaveBeenCalled();
  });
  it('после 402 принимает повторно подтверждённый достаточный баланс с той же суммой', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /^Продлить за 300\s*₽$/ }));
    await waitFor(() => expect(api.renew).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(api.purchase).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: /^Продлить за 300\s*₽$/ })).toBeTruthy();
    expect(screen.queryByText('Не хватает')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Оплатить/ })).toBeNull();
    expect(api.topUp).not.toHaveBeenCalled();
  });
  it('сохраняет серверную нехватку, если обновить баланс после 402 не удалось', async () => {
    api.purchase
      .mockResolvedValueOnce({ balance_kopeks: 100000 })
      .mockRejectedValueOnce(new AxiosError('Network Error'));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /^Продлить за 300\s*₽$/ }));
    await payButton();
    await waitFor(() => expect(api.purchase).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Не хватает')).toBeTruthy();
    expect(api.topUp).not.toHaveBeenCalled();
  });
  it('снимает блокировку после синхронной оплаты без промежуточного pending-рендера', async () => {
    state.balance = 15000;
    const pay = vi.fn();
    vi.spyOn(topUpPayment, 'useTopUpPayment').mockReturnValue({
      pay,
      isPending: false,
      error: null,
      setError: vi.fn(),
      paymentUrl: null,
      qrPayload: null,
      reset: vi.fn(),
    });
    mount();
    fireEvent.click(await payButton());
    await waitFor(() => expect(pay).toHaveBeenCalledTimes(1));
    fireEvent.click(await payButton());
    await waitFor(() => expect(api.renew).toHaveBeenCalledTimes(2));
    expect(pay).toHaveBeenCalledTimes(2);
  });
  it('409 обновляет подписку и варианты, не создавая оплату', async () => {
    state.balance = 15000;
    api.renew.mockRejectedValue(rejection(409, 'Периоды изменились'));
    const client = mount();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    fireEvent.click(await payButton());
    expect(await screen.findByText('Периоды изменились')).toBeTruthy();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['subscription', 42] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['renewal-options', 42] });
    expect(api.topUp).not.toHaveBeenCalled();
  });
  it('не принимает insufficient_funds без статуса 402 за разрешение оплаты', async () => {
    state.balance = 15000;
    api.renew.mockRejectedValue(
      rejection(400, { code: 'insufficient_funds', missing_amount: 15000 }),
    );
    mount();
    fireEvent.click(await payButton());
    await screen.findByRole('alert');
    expect(api.topUp).not.toHaveBeenCalled();
  });
  it('округляет серверную нехватку вверх до рубля', async () => {
    state.balance = 15000;
    api.renew.mockRejectedValue(
      rejection(402, { code: 'insufficient_funds', missing_amount: 15001 }),
    );
    mount();
    fireEvent.click(await payButton());
    await expectTopUp(15100);
  });
  it.each(['stars', 'antilopay', 'foreign'])(
    'передаёт дополнительный сценарий оплаты на его страницу: %s',
    async (kind) => {
      state.balance = 15000;
      if (kind === 'foreign') state.targetCurrency = 'USD';
      else state.methods[0].id = kind;
      mount();
      fireEvent.click(await payButton());
      expect((await screen.findByTestId('destination')).textContent).toBe(
        `/balance/top-up/${kind === 'foreign' ? 'yookassa' : kind}?amount=150`,
      );
      expect(api.renew).toHaveBeenCalledTimes(1);
      expect(api.topUp).not.toHaveBeenCalled();
    },
  );
  it('показывает готовый QR из платёжного API', async () => {
    state.balance = 15000;
    api.topUp.mockResolvedValue({
      payment_id: 'qr',
      payment_url: 'https://pay.example/qr',
      qr_payload: 'bank://qr',
      amount_kopeks: 15000,
      amount_rubles: 150,
      status: 'pending',
      expires_at: null,
    });
    mount();
    fireEvent.click(await payButton());
    expect(await screen.findByTestId('topup-qr')).toBeTruthy();
  });
  it('показывает бесплатное продление и устройства выбранного периода', async () => {
    state.options[0] = { ...state.options[0], price_kopeks: 0, extra_devices: 2 };
    mount();
    expect(await screen.findByRole('button', { name: 'Продлить бесплатно' })).toBeTruthy();
    expect(screen.getByText('+ 2 устройства')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /^2 мес/ }));
    expect(screen.queryByText('+ 2 устройства')).toBeNull();
  });
  it('выбирает операторский период из несортированного списка и сохраняет выбор после обновления', async () => {
    state.options = [
      state.options[2],
      { ...state.options[1], is_highlighted: true },
      state.options[0],
    ];
    const client = mount();
    expect(
      (await screen.findByRole('radio', { name: /^2 мес/ })).getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      screen.getAllByRole('radio').map((radio) => radio.textContent?.match(/\d мес/)?.[0]),
    ).toEqual(['1 мес', '2 мес', '3 мес']);
    fireEvent.click(screen.getByRole('radio', { name: /^3 мес/ }));
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['renewal-options', 42] });
    });
    expect(screen.getByRole('radio', { name: /^3 мес/ }).getAttribute('aria-checked')).toBe('true');
  });
  it('обрабатывает отсутствие доступных способов без сохранения продления', async () => {
    state.balance = 15000;
    state.methods[0].is_available = false;
    mount();
    expect(await screen.findByText(ruLocale.balance.noPaymentMethods)).toBeTruthy();
    expect(api.renew).not.toHaveBeenCalled();
  });
  it('показывает ошибку, если серверная сумма превышает максимум метода', async () => {
    state.balance = 15000;
    api.renew.mockRejectedValue(
      rejection(402, { code: 'insufficient_funds', missing_amount: 10000100 }),
    );
    mount();
    fireEvent.click(await payButton());
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(api.topUp).not.toHaveBeenCalled();
  });
});
