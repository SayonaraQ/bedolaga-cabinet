import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PiArrowsClockwise } from 'react-icons/pi';
import { useCurrency } from '@/hooks/useCurrency';
import { useTheme } from '@/hooks/useTheme';
import type { RenewalOption, Subscription } from '@/types';
import { pickAutopayOption } from '@/utils/balance/renewalPlan';
import { getGlassColors } from '@/utils/glassTheme';
import { showsAutopayToggle } from '@/utils/legacySubscription';
import { uiLocale } from '@/utils/uiLocale';

export function RenewAutopayNote({
  subscription,
  options,
  balanceKopeks,
  subId,
  now,
}: {
  subscription: Subscription;
  options: RenewalOption[];
  balanceKopeks: number;
  subId: number;
  now: Date;
}) {
  const { t } = useTranslation();
  const { formatAmount, currencySymbol } = useCurrency();
  const { isDark } = useTheme();
  const g = getGlassColors(isDark);
  const endDate = new Date(subscription.end_date);
  const option = pickAutopayOption(options, subscription.autopay_period_days);
  if (
    !showsAutopayToggle(subscription) ||
    subscription.is_expired ||
    subscription.status === 'expired' ||
    !Number.isFinite(endDate.getTime()) ||
    endDate.getTime() <= now.getTime() ||
    !option
  ) {
    return null;
  }

  const chargeDate = new Date(endDate.getTime() - subscription.autopay_days_before * 86400000);
  const passed = chargeDate.getTime() <= now.getTime();
  const covered = balanceKopeks >= option.price_kopeks;
  const enabled = subscription.autopay_enabled;
  const price = `${formatAmount(option.price_kopeks / 100, option.price_kopeks % 100 === 0 ? 0 : 2)}\u00A0${currencySymbol}`;
  const date = new Intl.DateTimeFormat(uiLocale(), {
    day: 'numeric',
    month: 'long',
    ...(chargeDate.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  }).format(chargeDate);

  return (
    <div
      className="glass-card overflow-hidden rounded-linear-lg border"
      style={{ background: g.cardBg, borderColor: g.cardBorder }}
    >
      <div className={`p-5 ${enabled && covered ? 'bg-success-500/10' : ''}`}>
        <div className="flex items-center gap-2">
          <PiArrowsClockwise
            className={`h-5 w-5 shrink-0 ${enabled && covered ? 'text-success-400' : 'text-dark-400'}`}
            aria-hidden
          />
          <h2
            className={`text-sm font-semibold ${enabled && covered ? 'text-success-400' : 'text-dark-100'}`}
          >
            {enabled ? t('subscription.renewPage.autopayOn') : t('balance.wallet.autopayDisabled')}
          </h2>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-dark-400">
          {enabled
            ? t(
                `subscription.renewPage.${covered ? (passed ? 'autopayCoveredSoon' : 'autopayCovered') : passed ? 'autopayWhenEnough' : 'autopayIfEnough'}`,
                { date, price },
              )
            : t('subscription.renewPage.autopayOffHint', {
                price,
                count: subscription.autopay_days_before,
              })}
        </p>
        {!enabled && (
          <Link
            className="mt-3 inline-flex text-sm font-semibold text-accent-400 hover:text-accent-300"
            to={`/subscriptions/${subId}`}
          >
            {t('balance.wallet.enableAutopay')}
          </Link>
        )}
      </div>
    </div>
  );
}
