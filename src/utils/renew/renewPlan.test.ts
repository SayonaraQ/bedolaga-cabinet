import { describe, expect, it } from 'vitest';
import type { RenewalOption } from '@/types';
import {
  paymentOptionLabel,
  periodLabel,
  periodSavingsKopeks,
  periodUnitPrice,
  pickDefaultPeriod,
  renewedEndDate,
  renewalShortfallKopeks,
  renewTopUpAmount,
  sortRenewalOptions,
} from './renewPlan';

function option(periodDays: number, priceKopeks: number, isHighlighted = false): RenewalOption {
  return {
    period_days: periodDays,
    price_kopeks: priceKopeks,
    price_rubles: priceKopeks / 100,
    discount_percent: 0,
    original_price_kopeks: null,
    is_highlighted: isHighlighted,
  };
}

describe('renewPlan', () => {
  it('sorts periods in a new array without changing the supplied options', () => {
    const options = [option(90, 85000), option(30, 30000), option(60, 58000)];

    const sorted = sortRenewalOptions(options);

    expect(sorted.map(({ period_days }) => period_days)).toEqual([30, 60, 90]);
    expect(options.map(({ period_days }) => period_days)).toEqual([90, 30, 60]);
    expect(sorted).not.toBe(options);
  });

  it('defaults to a highlighted period, an offered autopay period, or the shortest period', () => {
    const options = [option(90, 85000), option(30, 30000), option(60, 58000)];

    expect(pickDefaultPeriod([...options, option(180, 160000, true)], 30)).toBe(180);
    expect(pickDefaultPeriod(options, 60)).toBe(60);
    expect(pickDefaultPeriod(options, 45)).toBe(30);
    expect(pickDefaultPeriod([])).toBeNull();
  });

  it('calculates savings against the shortest paid period and never returns a negative saving', () => {
    const options = [option(90, 85000), option(30, 30000), option(60, 58000)];

    expect(periodSavingsKopeks(options[1], options)).toBe(0);
    expect(periodSavingsKopeks(options[2], options)).toBe(2000);
    expect(periodSavingsKopeks(options[0], options)).toBe(5000);

    const freeAndPaid = [option(30, 0), option(60, 50000)];
    expect(periodSavingsKopeks(freeAndPaid[1], freeAndPaid)).toBe(0);
    expect(periodSavingsKopeks(freeAndPaid[0], [freeAndPaid[0]])).toBe(0);
    expect(periodSavingsKopeks(option(60, 70000), options)).toBe(0);
  });

  it('labels multiples of thirty days as months and other periods as days', () => {
    expect(periodLabel(90)).toEqual({ unit: 'months', count: 3 });
    expect(periodLabel(7)).toEqual({ unit: 'days', count: 7 });
  });

  it('renews an active subscription from its end date and an expired subscription from now', () => {
    const now = new Date('2026-11-12T12:00:00Z');

    expect(renewedEndDate('2026-11-25T03:00:00Z', 30, now).toISOString()).toBe(
      '2026-12-25T03:00:00.000Z',
    );
    expect(renewedEndDate('2026-11-08T03:00:00Z', 30, now).toISOString()).toBe(
      '2026-12-12T12:00:00.000Z',
    );
  });

  it('rounds the missing balance up to a whole ruble and stops at zero', () => {
    expect(renewalShortfallKopeks(30000, 15000)).toBe(15000);
    expect(renewalShortfallKopeks(30000, 29950)).toBe(100);
    expect(renewalShortfallKopeks(30000, 40000)).toBe(0);
  });

  it('raises a top-up to the payment minimum and rejects zero or excessive amounts', () => {
    const method = { min_amount_kopeks: 10000, max_amount_kopeks: 10000000 };

    expect(renewTopUpAmount(15000, method)).toEqual({
      amountKopeks: 15000,
      raisedToMinimum: false,
    });
    expect(renewTopUpAmount(5000, method)).toEqual({
      amountKopeks: 10000,
      raisedToMinimum: true,
    });
    expect(renewTopUpAmount(0, method)).toBeNull();
    expect(renewTopUpAmount(20000000, method)).toBeNull();
  });

  it('removes leading payment icons while preserving a plain method name', () => {
    expect(paymentOptionLabel('🏦 СБП')).toBe('СБП');
    expect(paymentOptionLabel('Банковская карта')).toBe('Банковская карта');
    expect(paymentOptionLabel('💳 Карта')).toBe('Карта');
  });
  it('prices each period per month, or per day when shorter than a month', () => {
    expect(periodUnitPrice(option(30, 120000))).toEqual({ kopeks: 120000, unit: 'month' });
    expect(periodUnitPrice(option(60, 238000))).toEqual({ kopeks: 119000, unit: 'month' });
    // 3 500 ₽ за 90 дней = 1 166,67 ₽ в месяц — показываем целыми рублями.
    expect(periodUnitPrice(option(90, 350000))).toEqual({ kopeks: 116700, unit: 'month' });
    expect(periodUnitPrice(option(7, 10000))).toEqual({ kopeks: 1400, unit: 'day' });
    expect(periodUnitPrice(option(30, 0))).toBeNull();
  });
});
