import type { PaymentMethod, RenewalOption, Subscription } from '../../types';

export function pickAutopayOption(
  options: RenewalOption[],
  autopayPeriodDays?: number | null,
): RenewalOption | null {
  if (options.length === 0) return null;

  // Как и бот, при отсутствии настроенного периода выбираем самый короткий.
  const selected =
    options.find((option) => option.period_days === autopayPeriodDays) ??
    options.reduce((shortest, option) =>
      option.period_days < shortest.period_days ? option : shortest,
    );

  return selected.price_kopeks > 0 ? selected : null;
}

export type RenewalPlan = {
  kind: 'enough' | 'short' | 'expired';
  tariffName: string | null;
  extraDevices: number;
  periodDays: number;
  priceKopeks: number;
  renewalsCovered: number;
  shortfallKopeks: number;
  autopayEnabled: boolean;
  endDate: Date;
  chargeDate: Date;
  chargeDatePassed: boolean;
  subscriptionId: number;
};

export function buildRenewalPlan(input: {
  subscription: Subscription | null;
  options: RenewalOption[] | undefined;
  balanceKopeks: number;
  now: Date;
}): RenewalPlan | null {
  const { subscription, options, balanceKopeks, now } = input;
  if (!subscription || subscription.is_trial || subscription.is_daily || !options?.length) {
    return null;
  }

  const option = pickAutopayOption(options, subscription.autopay_period_days);
  if (!option) return null;

  const extraDevices = option.extra_devices ?? 0;
  const priceKopeks = option.price_kopeks;
  const endDate = new Date(subscription.end_date);
  const chargeDate = new Date(endDate.getTime() - 86400000 * subscription.autopay_days_before);

  return {
    kind:
      subscription.is_expired || subscription.status === 'expired'
        ? 'expired'
        : balanceKopeks >= priceKopeks
          ? 'enough'
          : 'short',
    tariffName: subscription.tariff_name ?? null,
    extraDevices: Number.isInteger(extraDevices) && extraDevices >= 0 ? extraDevices : 0,
    periodDays: option.period_days,
    priceKopeks,
    renewalsCovered: Math.floor(balanceKopeks / priceKopeks),
    shortfallKopeks: Math.ceil(Math.max(0, priceKopeks - balanceKopeks) / 100) * 100,
    autopayEnabled: subscription.autopay_enabled,
    endDate,
    chargeDate,
    chargeDatePassed: chargeDate.getTime() <= now.getTime(),
    subscriptionId: subscription.id,
  };
}

export type QuickTopUp = {
  amountKopeks: number;
  labelKey: 'shortfall' | 'months' | 'days' | 'plain';
  count: number;
};

export function buildQuickTopUps(
  plan: RenewalPlan | null,
  method: Pick<PaymentMethod, 'min_amount_kopeks' | 'max_amount_kopeks' | 'quick_amounts'>,
): { items: QuickTopUp[]; defaultIndex: number } {
  let items: QuickTopUp[];
  let defaultIndex: number;

  if (plan) {
    const hasShortfall = plan.shortfallKopeks > 0;
    const isMonthly = plan.periodDays % 30 === 0;
    const periodCount = isMonthly ? plan.periodDays / 30 : plan.periodDays;

    items = [0, 1, 2].map((index): QuickTopUp => {
      const renewals = hasShortfall ? index : index + 1;
      return {
        amountKopeks: (hasShortfall ? plan.shortfallKopeks : 0) + renewals * plan.priceKopeks,
        labelKey: hasShortfall && index === 0 ? 'shortfall' : isMonthly ? 'months' : 'days',
        count: renewals * periodCount,
      };
    });
    defaultIndex = hasShortfall ? 0 : 1;
  } else {
    items = (method.quick_amounts ?? [10000, 30000, 50000, 100000]).map((amountKopeks) => ({
      amountKopeks,
      labelKey: 'plain',
      count: 0,
    }));
    defaultIndex = 1;
  }

  const defaultItem = items[defaultIndex];
  const filteredItems = items.filter(
    ({ amountKopeks }) =>
      amountKopeks >= method.min_amount_kopeks && amountKopeks <= method.max_amount_kopeks,
  );

  return {
    items: filteredItems,
    defaultIndex: filteredItems.length === 0 ? -1 : Math.max(0, filteredItems.indexOf(defaultItem)),
  };
}
