import type { PaymentMethod, RenewalOption } from '@/types';

export function sortRenewalOptions(options: RenewalOption[]): RenewalOption[] {
  return [...options].sort((left, right) => left.period_days - right.period_days);
}

export function pickDefaultPeriod(
  options: RenewalOption[],
  autopayPeriodDays?: number | null,
): number | null {
  return (
    options.find((option) => option.is_highlighted)?.period_days ??
    options.find((option) => option.period_days === autopayPeriodDays)?.period_days ??
    sortRenewalOptions(options)[0]?.period_days ??
    null
  );
}

export function periodSavingsKopeks(option: RenewalOption, options: RenewalOption[]): number {
  const base = sortRenewalOptions(options).find((candidate) => candidate.price_kopeks > 0);
  if (!base) return 0;

  return Math.max(
    0,
    Math.round((base.price_kopeks * option.period_days) / base.period_days) - option.price_kopeks,
  );
}

export function periodLabel(days: number): { unit: 'months' | 'days'; count: number } {
  return days % 30 === 0 ? { unit: 'months', count: days / 30 } : { unit: 'days', count: days };
}

export function renewedEndDate(endDate: string, periodDays: number, now: Date): Date {
  return new Date(Math.max(new Date(endDate).getTime(), now.getTime()) + periodDays * 86400000);
}

export function renewalShortfallKopeks(price: number, balance: number): number {
  return Math.ceil(Math.max(0, price - balance) / 100) * 100;
}

export function renewTopUpAmount(
  shortfall: number,
  method: Pick<PaymentMethod, 'min_amount_kopeks' | 'max_amount_kopeks'>,
): { amountKopeks: number; raisedToMinimum: boolean } | null {
  if (shortfall <= 0) return null;

  const amountKopeks = Math.max(shortfall, method.min_amount_kopeks);
  if (amountKopeks > method.max_amount_kopeks) return null;

  return { amountKopeks, raisedToMinimum: amountKopeks > shortfall };
}

export function paymentOptionLabel(name: string): string {
  return name.replace(/^[^\p{L}\p{N}]+/u, '').trim();
}

/**
 * Цена срока в пересчёте на месяц (или на день для сроков короче месяца),
 * целыми рублями. У бесплатного срока цены за единицу нет.
 */
export function periodUnitPrice(
  option: RenewalOption,
): { kopeks: number; unit: 'month' | 'day' } | null {
  if (option.price_kopeks <= 0 || option.period_days <= 0) return null;
  if (option.period_days < 30) {
    return {
      kopeks: Math.round(option.price_kopeks / option.period_days / 100) * 100,
      unit: 'day',
    };
  }
  return {
    kopeks: Math.round((option.price_kopeks * 30) / option.period_days / 100) * 100,
    unit: 'month',
  };
}
