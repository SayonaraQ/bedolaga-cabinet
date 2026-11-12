import { useTranslation } from 'react-i18next';
import { PiWarning } from 'react-icons/pi';
import { useCurrency } from '@/hooks/useCurrency';
import { uiLocale } from '@/utils/uiLocale';

export function RenewSummary({
  newEndDate,
  priceKopeks,
  balanceKopeks,
  shortfallKopeks,
}: {
  newEndDate: Date;
  priceKopeks: number;
  balanceKopeks: number;
  shortfallKopeks: number;
}) {
  const { t } = useTranslation();
  const { formatAmount, currencySymbol } = useCurrency();
  const money = (kopeks: number) =>
    `${formatAmount(kopeks / 100, kopeks % 100 === 0 ? 0 : 2)}\u00A0${currencySymbol}`;
  const date = new Intl.DateTimeFormat(uiLocale(), {
    day: 'numeric',
    month: 'long',
    ...(newEndDate.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
  }).format(newEndDate);

  return (
    <dl className="mt-5 space-y-2.5 border-t border-dark-700/50 pt-4 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="min-w-0 text-dark-400">{t('subscription.renewPage.newEndLabel')}</dt>
        {/* Дата целиком в одну строку: на 320 px «г.» иначе уезжал строкой ниже. */}
        <dd className="shrink-0 whitespace-nowrap text-right text-lg font-semibold text-dark-50">
          {date}
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-dark-400">{t('subscription.renewPage.chargeLabel')}</dt>
        <dd className="font-semibold text-dark-100">{money(priceKopeks)}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-dark-400">{t('subscription.renewPage.balanceLabel')}</dt>
        <dd className="text-dark-100">{money(balanceKopeks)}</dd>
      </div>
      {shortfallKopeks > 0 && (
        <div className="flex items-baseline justify-between gap-3 text-warning-400">
          <dt className="flex items-center gap-1.5">
            <PiWarning className="h-4 w-4 shrink-0" aria-hidden />
            {t('subscription.renewPage.shortfallLabel')}
          </dt>
          <dd className="font-semibold">{money(shortfallKopeks)}</dd>
        </div>
      )}
    </dl>
  );
}
