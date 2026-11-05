// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { balanceApi } from '@/api/balance';
import ru from '@/locales/ru.json';
import type { PaymentMethod, RenewalOption, Subscription } from '@/types';
import { WalletCard } from './WalletCard';

const currency = vi.hoisted(() => ({ targetCurrency: 'RUB' }));
vi.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ({
    ...currency,
    currencySymbol: '₽',
    formatAmount: (amount: number, decimals = 2) =>
      new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(amount),
  }),
}));
vi.mock('@/platform', () => ({
  usePlatform: () => ({
    platform: 'web',
    openLink: vi.fn(),
    openTelegramLink: vi.fn(),
    haptic: { impact: vi.fn() },
  }),
}));
vi.mock('@/api/balance', () => ({ balanceApi: { createTopUp: vi.fn() } }));

const translations = createInstance();
await translations.init({ lng: 'ru', resources: { ru: { translation: ru } }, initAsync: false });
const now = new Date();
const endDate = new Date(now);
endDate.setDate(endDate.getDate() + 23);
const chargeDate = new Date(endDate);
chargeDate.setDate(chargeDate.getDate() - 3);
const subscription: Subscription = {
  id: 42,
  status: 'active',
  is_trial: false,
  start_date: now.toISOString(),
  end_date: endDate.toISOString(),
  days_left: 23,
  hours_left: 0,
  minutes_left: 0,
  time_left_display: '23 дня',
  traffic_limit_gb: 100,
  traffic_used_gb: 0,
  traffic_used_percent: 0,
  device_limit: 3,
  connected_squads: [],
  servers: [],
  autopay_enabled: true,
  autopay_days_before: 3,
  subscription_url: null,
  hide_subscription_link: false,
  is_active: true,
  is_expired: false,
  is_limited: false,
  tariff_name: 'Уверенный стандарт',
};
const renewalOptions: RenewalOption[] = [
  [30, 30000],
  [60, 58000],
  [90, 85000],
].map(([period_days, price_kopeks]) => ({
  period_days,
  price_kopeks,
  price_rubles: price_kopeks / 100,
  discount_percent: 0,
  original_price_kopeks: null,
}));
const method: PaymentMethod = {
  id: 'yookassa',
  name: 'ЮKassa',
  description: null,
  min_amount_kopeks: 1000,
  max_amount_kopeks: 1000000,
  is_available: true,
  options: [
    { id: 'card', name: '💳 Карта' },
    { id: 'sbp', name: '🏦 СБП' },
  ],
};
const payment = {
  payment_id: 'invoice-1',
  payment_url: 'https://example.com/pay',
  amount_kopeks: 60000,
  amount_rubles: 600,
  status: 'pending',
  expires_at: null,
};
let testTime = Date.now();
beforeEach(() => {
  testTime += 31000;
  vi.spyOn(Date, 'now').mockReturnValue(testTime);
  currency.targetCurrency = 'RUB';
  vi.mocked(balanceApi.createTopUp).mockResolvedValue(payment);
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

function Location() {
  const location = useLocation();
  return (
    <div>
      {location.pathname}
      {location.search}
    </div>
  );
}
function renderWallet(overrides: Partial<Parameters<typeof WalletCard>[0]> = {}) {
  return render(
    <I18nextProvider i18n={translations}>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
      >
        <MemoryRouter>
          <WalletCard
            balanceKopeks={102904}
            subscription={subscription}
            renewalOptions={renewalOptions}
            methods={[method]}
            {...overrides}
          />
          <Location />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

it('показывает покрытие трёх продлений, дату списания и пополнение на два месяца', () => {
  renderWallet();
  expect(screen.getByText('Хватит на 3 продления')).toBeTruthy();
  const date = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    ...(chargeDate.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  }).format(chargeDate);
  expect(screen.getByText(`${date} автопродление спишет 300 ₽ с баланса`)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Пополнить на 600\u00A0₽' })).toBeTruthy();
});

it.each([subscription.tariff_name, undefined])(
  'показывает дополнительное устройство и полную цену с названием тарифа %s',
  (tariffName) => {
    renderWallet({
      subscription: { ...subscription, tariff_name: tariffName },
      renewalOptions: renewalOptions.map((option) => {
        const priceKopeks = option.price_kopeks + (15000 * option.period_days) / 30;
        return {
          ...option,
          extra_devices: 1,
          price_kopeks: priceKopeks,
          price_rubles: priceKopeks / 100,
        };
      }),
    });
    const status = within(screen.getByRole('status'));
    const devices = status.getByText('+ 1 устройство');
    expect(devices.parentElement?.textContent).toBe(
      tariffName ? `${tariffName} + 1 устройство` : '+ 1 устройство',
    );
    expect(status.getByText('450 ₽ / 30 дн.')).toBeTruthy();
    expect(status.getByText('Хватит на 2 продления')).toBeTruthy();
  },
);

it.each([
  [2, '+ 2 устройства'],
  [5, '+ 5 устройств'],
])('склоняет число дополнительных устройств %i', (count, text) => {
  renderWallet({
    renewalOptions: renewalOptions.map((option) => ({ ...option, extra_devices: count })),
  });
  expect(within(screen.getByRole('status')).getByText(text)).toBeTruthy();
});

it('не показывает дополнительные устройства в статусе для опций старого бота', () => {
  renderWallet();
  expect(within(screen.getByRole('status')).queryByText(/устройств/)).toBeNull();
});

it('округляет нехватку вверх до рубля и выбирает её для пополнения', () => {
  renderWallet({ balanceKopeks: 12050 });
  expect(screen.getByText('Не хватает 180 ₽ на продление')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Пополнить на 180\u00A0₽' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '+ 1 месяц 480\u00A0₽' })).toBeTruthy();
});

it('предлагает включить автопродление на странице подписки', () => {
  renderWallet({ subscription: { ...subscription, autopay_enabled: false } });
  expect(screen.getByRole('link', { name: 'Включить' }).getAttribute('href')).toBe(
    '/subscriptions/42',
  );
});

it('предлагает ручное продление законченной подписки при достаточном балансе', () => {
  renderWallet({ subscription: { ...subscription, is_expired: true } });
  expect(screen.getByRole('link', { name: 'Продлить за 300\u00A0₽' }).getAttribute('href')).toBe(
    '/subscriptions/42/renew',
  );
});

it('без подписки показывает четыре обычные суммы без статуса', () => {
  renderWallet({ subscription: null });
  expect(screen.queryByRole('status')).toBeNull();
  for (const amount of ['100', '300', '500', '1\\s000']) {
    expect(screen.getByRole('button', { name: new RegExp(`^${amount}\u00A0₽$`) })).toBeTruthy();
  }
});

it('СБП стоит первым и выбран по умолчанию, хотя бот отдаёт «Карта, СБП»', async () => {
  renderWallet();
  const group = screen.getByRole('group', { name: 'Вариант оплаты' });
  const options = within(group).getAllByRole('button');
  expect(options.map((button) => button.textContent)).toEqual(['🏦 СБП', '💳 Карта']);
  expect(options[0].getAttribute('aria-pressed')).toBe('true');

  fireEvent.click(screen.getByRole('button', { name: 'Пополнить на 600\u00A0₽' }));
  await waitFor(() =>
    expect(balanceApi.createTopUp).toHaveBeenCalledWith(60000, 'yookassa', 'sbp'),
  );
});

it('два последовательных нажатия создают один счёт с выбранным СБП', async () => {
  let resolvePayment!: (result: typeof payment) => void;
  vi.mocked(balanceApi.createTopUp).mockReturnValue(
    new Promise((resolve) => {
      resolvePayment = resolve;
    }),
  );
  renderWallet();
  fireEvent.click(screen.getByRole('button', { name: '💳 Карта' }));
  fireEvent.click(screen.getByRole('button', { name: '🏦 СБП' }));
  const submit = screen.getByRole('button', { name: 'Пополнить на 600\u00A0₽' });
  act(() => {
    fireEvent.click(submit);
    fireEvent.click(submit);
  });
  await waitFor(() => expect(balanceApi.createTopUp).toHaveBeenCalledTimes(1));
  expect(balanceApi.createTopUp).toHaveBeenCalledWith(60000, 'yookassa', 'sbp');
  expect((submit as HTMLButtonElement).disabled).toBe(true);
  await act(async () => resolvePayment(payment));
  expect(await screen.findByText(ru.balance.paymentReady)).toBeTruthy();
});

it('сохраняет выбранную сумму при ошибке создания счёта', async () => {
  vi.mocked(balanceApi.createTopUp).mockRejectedValue({
    isAxiosError: true,
    response: { data: { detail: 'Платёж временно недоступен' } },
  });
  renderWallet();
  fireEvent.click(screen.getByRole('button', { name: '3 месяца 900\u00A0₽' }));
  fireEvent.click(screen.getByRole('button', { name: 'Пополнить на 900\u00A0₽' }));
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    'Платёж временно недоступен',
  );
  expect(
    screen.getByRole('button', { name: '3 месяца 900\u00A0₽' }).getAttribute('aria-pressed'),
  ).toBe('true');
});

it('ручной ввод снимает выбор, а быстрая сумма очищает поле', () => {
  renderWallet();
  const input = screen.getByRole('textbox', { name: 'Другая сумма' });
  fireEvent.change(input, { target: { value: '250' } });
  expect(screen.getByRole('button', { name: 'Пополнить на 250\u00A0₽' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /месяц/, pressed: true })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '1 месяц 300\u00A0₽' }));
  expect((input as HTMLInputElement).value).toBe('');
});

it.each(['', '9', '10001', '-5', 'abc'])('запрещает оплату недопустимой суммы «%s»', (value) => {
  renderWallet();
  fireEvent.change(screen.getByRole('textbox', { name: 'Другая сумма' }), {
    target: { value: value || ' ' },
  });
  expect((screen.getByRole('button', { name: /^Пополнить/ }) as HTMLButtonElement).disabled).toBe(
    true,
  );
});

it.each(['stars', 'antilopay', 'foreign'])('переводит особый способ %s на экран суммы', (id) => {
  if (id === 'foreign') currency.targetCurrency = 'USD';
  const selectedMethod = id === 'foreign' ? method : { ...method, id };
  renderWallet({ methods: [selectedMethod] });
  fireEvent.click(screen.getByRole('button', { name: 'Пополнить на 600\u00A0₽' }));
  expect(screen.getByText(`/balance/top-up/${selectedMethod.id}?amount=600`)).toBeTruthy();
  expect(balanceApi.createTopUp).not.toHaveBeenCalled();
});

it('скрывает пополнение, когда нет доступных способов', () => {
  renderWallet({ methods: [{ ...method, is_available: false }] });
  expect(screen.queryByRole('button', { name: /^Пополнить/ })).toBeNull();
  expect(screen.queryByRole('textbox')).toBeNull();
});

it.each([
  [102904, 'Ближайшее автопродление — сегодня, спишет 300 ₽ с баланса'],
  [12050, 'Автопродление спишет 300 ₽ с баланса, как только хватит денег'],
])(
  'при прошедшей дате списания и балансе %i не предлагает пополнить задним числом',
  (balanceKopeks, text) => {
    const soon = new Date(now);
    soon.setDate(soon.getDate() + 2);
    renderWallet({
      balanceKopeks,
      subscription: { ...subscription, end_date: soon.toISOString() },
    });
    expect(screen.getByText(text)).toBeTruthy();
  },
);

it('у законченной подписки с нехваткой предлагает пополнить баланс без обещания автосписания', () => {
  renderWallet({ balanceKopeks: 12050, subscription: { ...subscription, status: 'expired' } });
  expect(screen.getByText(/^Подписка закончилась/)).toBeTruthy();
  expect(screen.getByText('Не хватает 180 ₽ на продление')).toBeTruthy();
  expect(screen.queryByRole('link', { name: /^Продлить/ })).toBeNull();
  expect(screen.queryByText(/автопродление спишет/i)).toBeNull();
});

it('добавляет год к дате списания в другом году', () => {
  const nextYear = new Date(now.getFullYear() + 1, 5, 20, 12);
  const nextCharge = new Date(nextYear);
  nextCharge.setDate(nextCharge.getDate() - 3);
  renderWallet({ subscription: { ...subscription, end_date: nextYear.toISOString() } });
  const date = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(nextCharge);
  expect(screen.getByText(`${date} автопродление спишет 300 ₽ с баланса`)).toBeTruthy();
});

it.each([
  { subscription: { ...subscription, is_trial: true } },
  { subscription: { ...subscription, is_daily: true } },
  { renewalOptions: undefined },
  { renewalOptions: [] },
])('скрывает статус, когда цену автопродления нельзя определить: %o', (overrides) => {
  renderWallet(overrides);
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.getByRole('button', { name: 'Пополнить на 300\u00A0₽' })).toBeTruthy();
});

it('выбирает первый доступный способ и пересчитывает суммы при переключении', () => {
  renderWallet({
    methods: [
      { ...method, id: 'unavailable', name: 'Недоступен', is_available: false },
      method,
      { ...method, id: 'other', name: 'Другой', options: null, max_amount_kopeks: 50000 },
    ],
  });
  expect(screen.getByRole('button', { name: 'ЮKassa', pressed: true })).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Недоступен' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Другой' }));
  expect(screen.getByRole('button', { name: 'Другой', pressed: true })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Пополнить на 300\u00A0₽' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: '🏦 СБП' })).toBeNull();
});

it('для периода не кратного месяцу показывает дни с прибавкой при нехватке', () => {
  renderWallet({
    balanceKopeks: 12050,
    renewalOptions: [{ ...renewalOptions[0], period_days: 7 }],
  });
  expect(screen.getByRole('button', { name: '+ 7 дней 480\u00A0₽' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '+ 14 дней 780\u00A0₽' })).toBeTruthy();
});
