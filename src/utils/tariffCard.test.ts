import { describe, expect, it } from 'vitest';
import { combinePromoDiscount, type ApplyPromoDiscount } from '@/hooks/usePromoDiscount';
import type { Tariff, TariffPeriod } from '@/types';
import {
  bestPerDeviceTariff,
  canBuyMoreDevices,
  initialOpenTariffId,
  longPeriodMonthly,
  tariffHeadlinePrice,
  trafficPeriod,
} from './tariffCard';

const apply: ApplyPromoDiscount = (price, original) => combinePromoDiscount(price, original, 0);
const discount: ApplyPromoDiscount = (price, original) => combinePromoDiscount(price, original, 10);
const tariff = (id: number, limit: number, prices: number[]): Tariff =>
  ({
    id,
    device_limit: limit,
    periods: prices.map((price, i) => ({
      days: (i + 1) * 30,
      months: i + 1,
      price_kopeks: price,
    })),
  }) as Tariff;
const basic = tariff(1, 1, [20000, 38000, 55000]);
const standard = tariff(2, 3, [30000, 58000, 85000]);
const family = tariff(3, 7, [75000, 148000, 215000]);
const premium = tariff(4, 3, [60000, 118000, 175000]);
const daily = { ...standard, daily_price_kopeks: 1000 };
const flexible = { ...standard, periods: [] };

describe('tariff card prices', () => {
  it.each([
    [basic, 18300],
    [standard, 28300],
    [family, 71700],
    [premium, 58300],
  ])('rounds the longest discounted period to whole rubles: $id', (value, price) => {
    expect(longPeriodMonthly(value, apply)).toEqual({ months: 3, perMonthKopeks: price });
  });

  it('applies promo discounts to headline, long period and device prices', () => {
    expect(tariffHeadlinePrice(standard, discount)).toMatchObject({
      kind: 'month',
      quote: { price: 27000 },
    });
    expect(longPeriodMonthly(standard, discount)).toEqual({ months: 3, perMonthKopeks: 25500 });
    expect(bestPerDeviceTariff([basic, standard, family, premium], discount)).toEqual({
      tariffId: 2,
      perDeviceKopeks: 9000,
    });
  });

  it('preserves promo-group originals and combines the active discount once', () => {
    const grouped = {
      ...standard,
      periods: standard.periods.map((p) => ({ ...p, original_price_kopeks: p.price_kopeks * 2 })),
    };
    expect(tariffHeadlinePrice(grouped, discount)).toEqual({
      kind: 'month',
      quote: { price: 27000, original: 60000, percent: 55, isPromoGroup: true },
    });
    expect(longPeriodMonthly(grouped, discount)).toEqual({ months: 3, perMonthKopeks: 25500 });
    expect(bestPerDeviceTariff([basic, grouped], discount)?.perDeviceKopeks).toBe(9000);
  });

  it('only offers a cheaper monthly quote for tariffs with a monthly period', () => {
    for (const value of [
      tariff(1, 1, [30000]),
      tariff(1, 1, [30000, 60000, 90000]),
      daily,
      flexible,
    ]) {
      expect(longPeriodMonthly(value, apply)).toBeNull();
    }
    const unsorted = { ...standard, periods: [...standard.periods].reverse() };
    expect(longPeriodMonthly(unsorted, apply)).toEqual({ months: 3, perMonthKopeks: 28300 });
  });

  it('uses daily, monthly, first period, then flexible headline quotes', () => {
    expect(tariffHeadlinePrice(daily, apply)).toMatchObject({
      kind: 'daily',
      quote: { price: 1000 },
    });
    expect(
      tariffHeadlinePrice({ ...standard, periods: [...standard.periods].reverse() }, apply),
    ).toMatchObject({ kind: 'month', quote: { price: 30000 } });
    expect(
      tariffHeadlinePrice(
        { ...basic, periods: [{ days: 7, months: 0, price_kopeks: 9000 } as TariffPeriod] },
        apply,
      ),
    ).toMatchObject({ kind: 'period', days: 7, quote: { price: 9000 } });
    expect(tariffHeadlinePrice(flexible, apply)).toEqual({ kind: 'flexible' });
  });

  it('awards only a unique minimum among at least two eligible tariffs', () => {
    expect(bestPerDeviceTariff([basic, standard, family, premium], apply)).toEqual({
      tariffId: 2,
      perDeviceKopeks: 10000,
    });
    expect(bestPerDeviceTariff([standard], apply)).toBeNull();
    expect(bestPerDeviceTariff([standard, { ...standard, id: 9 }], apply)).toBeNull();
    expect(
      bestPerDeviceTariff([basic, daily, flexible, tariff(5, 0, [100]), tariff(6, 1, [0])], apply),
    ).toBeNull();
    expect(
      bestPerDeviceTariff([basic, { ...standard, base_device_limit: 3, device_limit: 9 }], apply),
    ).toEqual({ tariffId: 2, perDeviceKopeks: 10000 });
  });
});

it('opens current, then highlighted, then first tariff', () => {
  const highlighted = { ...standard, is_highlighted: true };
  expect(initialOpenTariffId([basic, highlighted, family], family.id)).toBe(family.id);
  expect(initialOpenTariffId([basic, highlighted, { ...family, is_current: true }], null)).toBe(
    family.id,
  );
  expect(initialOpenTariffId([basic, highlighted], null)).toBe(standard.id);
  expect(initialOpenTariffId([basic, standard], null)).toBe(basic.id);
  expect(initialOpenTariffId([], undefined)).toBeNull();
});

it.each([
  [undefined, 'none'],
  [null, 'none'],
  ['NO_RESET', 'none'],
  ['other', 'none'],
  ['MONTH', 'month'],
  ['MONTH_ROLLING', 'month'],
  ['WEEK', 'week'],
  ['DAY', 'day'],
])('maps traffic reset %s to %s', (mode, expected) => {
  expect(trafficPeriod(mode)).toBe(expected);
});

it('shows an upgrade ceiling only above a positive included device limit', () => {
  expect(canBuyMoreDevices({ ...standard, max_device_limit: 10 })).toBe(10);
  for (const value of [
    { ...standard, max_device_limit: null },
    standard,
    { ...standard, device_limit: 0, max_device_limit: 10 },
    { ...standard, max_device_limit: 3 },
    { ...standard, max_device_limit: 2 },
  ])
    expect(canBuyMoreDevices(value)).toBeNull();
});
