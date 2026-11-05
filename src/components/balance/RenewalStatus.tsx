import { PiWarning } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { CheckIcon } from '@/components/icons';
import { Button } from '@/components/primitives/Button';
import { useCurrency } from '@/hooks/useCurrency';
import type { RenewalPlan } from '@/utils/balance/renewalPlan';
import { uiLocale } from '@/utils/uiLocale';

export function RenewalStatus({ plan }: { plan: RenewalPlan }) {
  const { t } = useTranslation();
  const { formatAmount, currencySymbol } = useCurrency();
  const money = (kopeks: number) =>
    `${formatAmount(kopeks / 100, kopeks % 100 === 0 ? 0 : 2)}\u00A0${currencySymbol}`;
  const date = (value: Date) =>
    new Intl.DateTimeFormat(uiLocale(), {
      day: 'numeric',
      month: 'long',
      ...(value.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
    }).format(value);
  const price = money(plan.priceKopeks);
  const shortfall = money(plan.shortfallKopeks);
  const enough = plan.kind === 'enough';
  const status = enough
    ? t('balance.wallet.renewalsCovered', { count: plan.renewalsCovered })
    : plan.kind === 'short'
      ? t('balance.wallet.shortfall', { amount: shortfall })
      : t('balance.wallet.expired', { endDate: date(plan.endDate) });
  const explanationKey = plan.chargeDatePassed
    ? enough
      ? 'chargeToday'
      : 'chargeWhenEnough'
    : enough
      ? 'chargeScheduled'
      : 'topUpBeforeCharge';

  return (
    <div
      role="status"
      className={`mt-5 space-y-2 rounded-linear-lg border p-3 sm:p-4 ${
        enough
          ? 'border-success-500/30 bg-success-500/10'
          : 'border-warning-500/30 bg-warning-500/10'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2 text-xs text-dark-400 sm:text-sm">
        <span className="min-w-0 [overflow-wrap:anywhere]">
          {plan.tariffName}
          {plan.extraDevices > 0 && (
            <>
              {plan.tariffName ? ' ' : null}
              <span className="whitespace-nowrap font-semibold text-dark-100">
                {t('balance.wallet.extraDevices', { count: plan.extraDevices })}
              </span>
            </>
          )}
        </span>
        <span className="shrink-0">
          {t('balance.wallet.periodPrice', { price, count: plan.periodDays })}
        </span>
      </div>
      <div
        className={`flex items-start gap-2 font-semibold ${enough ? 'text-success-400' : 'text-warning-400'}`}
      >
        {enough ? (
          <CheckIcon className="mt-0.5 h-5 w-5 shrink-0" />
        ) : (
          <PiWarning className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        )}
        <span>{status}</span>
      </div>
      <div className="text-xs text-dark-400 sm:text-sm">
        {plan.kind === 'expired' ? (
          plan.shortfallKopeks === 0 ? (
            <Button asChild variant="secondary" size="sm">
              <Link to={`/subscriptions/${plan.subscriptionId}/renew`}>
                {t('balance.wallet.renew', { price })}
              </Link>
            </Button>
          ) : (
            t('balance.wallet.shortfall', { amount: shortfall })
          )
        ) : !plan.autopayEnabled ? (
          <>
            {t('balance.wallet.autopayDisabled')}{' '}
            <Link
              className="font-medium text-accent-400 hover:text-accent-300"
              to={`/subscriptions/${plan.subscriptionId}`}
            >
              {t('balance.wallet.enableAutopay')}
            </Link>
          </>
        ) : (
          t(`balance.wallet.${explanationKey}`, {
            price,
            chargeDate: date(plan.chargeDate),
            endDate: date(plan.endDate),
          })
        )}
      </div>
    </div>
  );
}
