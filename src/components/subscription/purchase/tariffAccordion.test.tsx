// @vitest-environment jsdom
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { createInstance } from 'i18next';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ru from '@/locales/ru.json';
import { combinePromoDiscount } from '@/hooks/usePromoDiscount';
import type { TariffPeriod, TariffsPurchaseOptions } from '@/types';
import { cardFor, render } from '../tariffGridHarness';

const i18n = createInstance();
const promo = { percent: 0 };
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: i18n.t.bind(i18n) }) }));
vi.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ isDark: true }) }));
vi.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ({
    currencySymbol: '₽',
    formatAmount: (n: number, decimals = 2) => n.toFixed(decimals),
  }),
}));
vi.mock('@/hooks/usePromoDiscount', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/usePromoDiscount')>()),
  usePromoDiscount: () => ({
    applyPromoDiscount: (price: number, original?: number | null) =>
      combinePromoDiscount(price, original, promo.percent),
  }),
}));

const tariffs = [
  { id: 1, name: 'Базовый', device_limit: 1, prices: [20000, 38000, 55000] },
  {
    id: 2,
    name: 'Уверенный стандарт',
    device_limit: 3,
    prices: [30000, 58000, 85000],
    is_highlighted: true,
  },
  { id: 3, name: 'Семейный', device_limit: 7, prices: [75000, 148000, 215000] },
  {
    id: 4,
    name: 'Роскошный максимум',
    device_limit: 3,
    prices: [60000, 118000, 175000],
    has_premium_servers: true,
  },
].map(({ prices, ...fields }) => ({
  tagline: 'Для всей семьи',
  description: 'Описание для бота',
  speed_limit_mbps: fields.id === 4 ? 500 : 50,
  traffic_limit_gb: 70,
  traffic_reset_mode: 'MONTH',
  max_device_limit: 10,
  periods: prices.map(
    (price, i) => ({ days: (i + 1) * 30, months: i + 1, price_kopeks: price }) as TariffPeriod,
  ),
  ...fields,
}));
const common_features = [
  { icon: 'globe', text: 'Все локации' },
  { icon: 'youtube', text: 'YouTube без рекламы' },
  { icon: 'infinity', text: 'Безлимит, кроме белых списков' },
  { icon: 'plus', text: 'Устройства и трафик можно докупить' },
];
const purchaseOptions = { sales_mode: 'tariffs', common_features } as TariffsPurchaseOptions;
const header = (name: string) => {
  const button = cardFor(name).querySelector<HTMLButtonElement>('button[aria-expanded]');
  if (!button) throw new Error(`Missing accordion header: ${name}`);
  return button;
};
const toggle = (name: string) => fireEvent.click(header(name));
const expanded = () => screen.getAllByRole('button', { expanded: true });

beforeEach(async () => {
  promo.percent = 0;
  await i18n.init({
    lng: 'ru',
    resources: { ru: { translation: ru } },
    interpolation: { escapeValue: false },
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('opens highlighted tariff by default with just one action', () => {
  render(tariffs);
  expect(expanded()).toEqual([header('Уверенный стандарт')]);
  expect(screen.getAllByRole('button', { name: 'Купить' })).toHaveLength(1);
  expect(header('Уверенный стандарт').getAttribute('aria-controls')).toBeTruthy();
});

it('opens current tariff instead of highlighted and replaces its popular badge', () => {
  render(
    tariffs.map((tariff) => ({
      ...tariff,
      is_highlighted: tariff.id === 3 || tariff.is_highlighted,
    })),
    { currentTariffId: 3 },
  );
  expect(expanded()).toEqual([header('Семейный')]);
  expect(within(cardFor('Семейный')).getByText('Текущий тариф')).toBeTruthy();
  expect(within(cardFor('Семейный')).queryByText('Чаще всего выбирают')).toBeNull();
});

it('only one open; tapping open closes it', () => {
  render(tariffs);
  toggle('Роскошный максимум');
  expect(expanded()).toEqual([header('Роскошный максимум')]);
  expect(header('Уверенный стандарт').getAttribute('aria-expanded')).toBe('false');
  toggle('Роскошный максимум');
  expect(screen.queryAllByRole('button', { expanded: true })).toHaveLength(0);
  expect(screen.queryByText('Премиум-серверы')).toBeNull();
});

it('premium row is gold, speed is dedicated and device ceiling is visible', () => {
  render(tariffs);
  toggle('Роскошный максимум');
  expect(screen.getByText('Премиум-серверы').className).toContain('text-urgent-400');
  expect(screen.getByText('Выделенная скорость')).toBeTruthy();
  expect(screen.getByText('до 500 Мбит/с').className).toContain('whitespace-nowrap');
  expect(screen.getByText('можно до 10').className).toContain('whitespace-nowrap');
  expect(screen.getByText('3 устройства')).toBeTruthy();
  expect(screen.getByText('70 ГБ')).toBeTruthy();
  expect(screen.getByText('в месяц на белые списки')).toBeTruthy();
});

it('best per device only on Standard', () => {
  render(tariffs);
  expect(screen.getByText('100 ₽ за устройство')).toBeTruthy();
  expect(screen.getByText(/выгоднее всех/)).toBeTruthy();
  toggle('Базовый');
  expect(screen.queryByText(/за устройство/)).toBeNull();
  expect(screen.queryByText(/выгоднее всех/)).toBeNull();
});

it('price per month and 3-month line', () => {
  render(tariffs);
  expect(within(header('Уверенный стандарт')).getByText('300 ₽')).toBeTruthy();
  expect(within(cardFor('Уверенный стандарт')).getAllByText('в месяц')).toHaveLength(2);
  expect(screen.getByText('283 ₽/мес при оплате за 3 месяца')).toBeTruthy();
});

it('promo discount reaches header, body, long-period and per-device prices', () => {
  promo.percent = 10;
  render(tariffs);
  expect(within(header('Уверенный стандарт')).getByText('270 ₽')).toBeTruthy();
  expect(within(cardFor('Уверенный стандарт')).getAllByText('270 ₽')).toHaveLength(2);
  expect(screen.getByText('255 ₽/мес при оплате за 3 месяца')).toBeTruthy();
  expect(screen.getByText('90 ₽ за устройство')).toBeTruthy();
  expect(screen.getByText('-10%')).toBeTruthy();
  expect(within(cardFor('Уверенный стандарт')).getByText('300 ₽').className).toContain(
    'line-through',
  );
});

it('common features block has four items and disappears when empty', () => {
  const rendered = render(tariffs, { purchaseOptions });
  const section = screen.getByRole('region', { name: 'Во всех тарифах' });
  expect(within(section).getAllByRole('listitem')).toHaveLength(4);
  for (const feature of common_features)
    expect(within(section).getByText(feature.text)).toBeTruthy();
  rendered.unmount();
  render(tariffs, { purchaseOptions: { ...purchaseOptions, common_features: [] } });
  expect(screen.queryByText('Во всех тарифах')).toBeNull();
});

it('legacy tariff shows description only without tagline', () => {
  render([{ ...tariffs[0], tagline: undefined, description: 'Старое описание' }, tariffs[1]]);
  expect(screen.queryByText('Описание для бота')).toBeNull();
  toggle('Базовый');
  expect(screen.getByText('Старое описание').className).toContain('whitespace-pre-line');
});

it('unknown common feature icons fall back to check, including inherited object names', () => {
  render(tariffs, {
    purchaseOptions: {
      ...purchaseOptions,
      common_features: ['check', 'rocket', 'constructor', '__proto__', 'premium'].map((icon) => ({
        icon,
        text: icon,
      })),
    },
  });
  const section = screen.getByRole('region', { name: 'Во всех тарифах' });
  const icons = [...section.querySelectorAll('svg')];
  expect(icons).toHaveLength(5);
  expect(icons.map((icon) => icon.innerHTML)).toEqual(Array(5).fill(icons[0].innerHTML));
});

it('keeps header under finger when collapsing the card above it', () => {
  render(tariffs);
  const button = header('Роскошный максимум');
  vi.spyOn(button, 'getBoundingClientRect')
    .mockReturnValueOnce({ top: 600 } as DOMRect)
    .mockReturnValue({ top: 300 } as DOMRect);
  const scroll = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
  fireEvent.click(button);
  expect(scroll).toHaveBeenCalledExactlyOnceWith({ top: -300, behavior: 'instant' });
});

it('actions unchanged: current extends through select, other switches by id', () => {
  const onSelectTariff = vi.fn();
  const onSwitchTariff = vi.fn();
  render(tariffs, {
    subscription: { id: 42, tariff_id: 3, is_active: true, is_trial: false },
    onSelectTariff,
    onSwitchTariff,
  });
  fireEvent.click(screen.getByRole('button', { name: 'Продлить подписку' }));
  expect(onSelectTariff).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ id: 3, periods: tariffs[2].periods }),
  );
  toggle('Уверенный стандарт');
  fireEvent.click(screen.getByRole('button', { name: 'Перейти' }));
  expect(onSwitchTariff).toHaveBeenCalledExactlyOnceWith(2);
  expect(onSelectTariff).toHaveBeenCalledTimes(1);
});

it('switch selection keeps its accessible label and callback', () => {
  const onSwitchTariff = vi.fn();
  const onSelectTariff = vi.fn();
  render(tariffs, { currentTariffId: 3, switchSelection: true, onSwitchTariff, onSelectTariff });
  toggle('Уверенный стандарт');
  fireEvent.click(screen.getByRole('button', { name: 'Уверенный стандарт: Выбрать' }));
  expect(onSwitchTariff).toHaveBeenCalledExactlyOnceWith(2);
  expect(onSelectTariff).not.toHaveBeenCalled();
});

it('current daily has no action button; flexible tariff has no monthly savings', () => {
  const view = render([{ ...tariffs[0], is_daily: true, daily_price_kopeks: 1000 }], {
    subscription: { tariff_id: 1, is_daily: true },
  });
  expect(screen.getAllByRole('button')).toHaveLength(1);
  expect(screen.getAllByText('в день')).toHaveLength(2);
  expect(screen.queryByText(/при оплате/)).toBeNull();
  view.unmount();
  render([{ ...tariffs[0], periods: [] }]);
  expect(screen.getAllByText('Гибкая оплата')).toHaveLength(2);
  expect(screen.queryByText(/при оплате/)).toBeNull();
});
