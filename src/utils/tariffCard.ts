import { dailyPriceQuote } from '@/components/subscription/purchase/dailyPrice';
import type { ApplyPromoDiscount, PromoDiscountResult } from '@/hooks/usePromoDiscount';
import type { Tariff } from '@/types';

export type HeadlinePrice =
  | { kind: 'month'; quote: PromoDiscountResult }
  | { kind: 'period'; days: number; quote: PromoDiscountResult }
  | { kind: 'daily'; quote: PromoDiscountResult }
  | { kind: 'flexible' };

export function tariffHeadlinePrice(tariff: Tariff, apply: ApplyPromoDiscount): HeadlinePrice {
  const daily = dailyPriceQuote(tariff, apply);
  if (daily) return { kind: 'daily', quote: daily };
  const monthly = tariff.periods.find((period) => period.days === 30);
  const period = monthly ?? tariff.periods[0];
  if (!period) return { kind: 'flexible' };
  const quote = apply(period.price_kopeks, period.original_price_kopeks);
  return monthly ? { kind: 'month', quote } : { kind: 'period', days: period.days, quote };
}

export function longPeriodMonthly(
  tariff: Tariff,
  apply: ApplyPromoDiscount,
): { months: number; perMonthKopeks: number } | null {
  const headline = tariffHeadlinePrice(tariff, apply);
  if (headline.kind !== 'month') return null;
  const longest = tariff.periods
    .filter((period) => period.months >= 2)
    .reduce<(typeof tariff.periods)[number] | undefined>(
      (best, period) => (!best || period.months > best.months ? period : best),
      undefined,
    );
  if (!longest) return null;
  const quote = apply(longest.price_kopeks, longest.original_price_kopeks);
  const perMonthKopeks = Math.round(quote.price / longest.months / 100) * 100;
  return perMonthKopeks < headline.quote.price ? { months: longest.months, perMonthKopeks } : null;
}

export function bestPerDeviceTariff(
  tariffs: Tariff[],
  apply: ApplyPromoDiscount,
): { tariffId: number; perDeviceKopeks: number } | null {
  const candidates = tariffs.flatMap((tariff) => {
    const headline = tariffHeadlinePrice(tariff, apply);
    const limit = tariff.base_device_limit ?? tariff.device_limit;
    return headline.kind === 'month' && headline.quote.price > 0 && limit > 0
      ? [{ tariffId: tariff.id, perDevice: headline.quote.price / limit }]
      : [];
  });
  if (candidates.length < 2) return null;
  const minimum = Math.min(...candidates.map((candidate) => candidate.perDevice));
  const winners = candidates.filter((candidate) => candidate.perDevice === minimum);
  return winners.length === 1
    ? { tariffId: winners[0].tariffId, perDeviceKopeks: Math.round(minimum) }
    : null;
}

export function initialOpenTariffId(
  tariffs: Tariff[],
  currentTariffId: number | null | undefined,
): number | null {
  return (
    tariffs.find((tariff) => tariff.is_current || tariff.id === currentTariffId)?.id ??
    tariffs.find((tariff) => tariff.is_highlighted)?.id ??
    tariffs[0]?.id ??
    null
  );
}

export function trafficPeriod(mode: string | null | undefined): 'month' | 'week' | 'day' | 'none' {
  switch (mode) {
    case 'MONTH':
    case 'MONTH_ROLLING':
      return 'month';
    case 'WEEK':
      return 'week';
    case 'DAY':
      return 'day';
    default:
      return 'none';
  }
}

export function canBuyMoreDevices(tariff: Tariff): number | null {
  return tariff.device_limit > 0 && (tariff.max_device_limit ?? 0) > tariff.device_limit
    ? (tariff.max_device_limit ?? null)
    : null;
}
