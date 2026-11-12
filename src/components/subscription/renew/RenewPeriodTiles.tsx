import { useTranslation } from 'react-i18next';
import { useCurrency } from '@/hooks/useCurrency';
import { useTheme } from '@/hooks/useTheme';
import type { RenewalOption } from '@/types';
import { getGlassColors } from '@/utils/glassTheme';
import { periodLabel, periodSavingsKopeks } from '@/utils/renew/renewPlan';
import { BEST_VALUE_BORDER, BestValueBadge } from '../BestValueBadge';

export function RenewPeriodTiles({
  options,
  selectedDays,
  onSelect,
  disabled,
}: {
  options: RenewalOption[];
  selectedDays: number | null;
  onSelect: (days: number) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { formatAmount, currencySymbol } = useCurrency();
  const { isDark } = useTheme();
  const g = getGlassColors(isDark);
  const money = (kopeks: number) =>
    `${formatAmount(kopeks / 100, kopeks % 100 === 0 ? 0 : 2)}\u00A0${currencySymbol}`;
  const columns =
    options.length === 1
      ? 'grid-cols-1'
      : options.length === 2 || options.length === 4
        ? 'grid-cols-2'
        : 'grid-cols-3';

  return (
    <div
      className={`grid gap-2 ${columns}`}
      role="radiogroup"
      aria-label={t('subscription.renewPage.periodHeading')}
    >
      {options.map((option) => {
        const selected = selectedDays === option.period_days;
        const highlighted = Boolean(option.is_highlighted);
        const label = periodLabel(option.period_days);
        const savings = periodSavingsKopeks(option, options);
        const promo = (option.original_price_kopeks ?? 0) > option.price_kopeks;

        return (
          <button
            key={option.period_days}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onSelect(option.period_days)}
            className={`glass-card flex min-w-0 flex-col items-center justify-center rounded-linear-lg px-2 py-3 text-center transition-colors disabled:opacity-50 ${highlighted ? 'border-2' : 'border'}`}
            style={{
              background: selected ? 'rgba(var(--color-accent-400), 0.08)' : g.cardBg,
              borderColor: highlighted
                ? BEST_VALUE_BORDER
                : selected
                  ? 'rgb(var(--color-accent-400))'
                  : g.cardBorder,
              boxShadow:
                selected && highlighted
                  ? 'inset 0 0 0 2px rgb(var(--color-accent-400))'
                  : undefined,
            }}
          >
            <span className="text-base font-semibold text-dark-50">
              {t(`subscription.renewPage.${label.unit}`, { count: label.count })}
            </span>
            <span className="mt-0.5 text-sm text-dark-100">
              {option.price_kopeks === 0 ? t('subscription.free') : money(option.price_kopeks)}
            </span>
            <div className="mt-1 flex min-h-5 w-full min-w-0 flex-wrap items-center justify-center gap-1 text-[11px]">
              {highlighted && (
                <BestValueBadge className="max-w-full flex-wrap justify-center px-1 tracking-normal" />
              )}
              {promo ? (
                <>
                  <span className="text-dark-400 line-through">
                    {money(option.original_price_kopeks ?? 0)}
                  </span>
                  {option.discount_percent > 0 && (
                    <span className="rounded-full bg-success-400/15 px-1.5 py-0.5 font-semibold text-success-400">
                      -{option.discount_percent}%
                    </span>
                  )}
                </>
              ) : (
                savings > 0 && (
                  <span className="font-semibold text-success-400">−{money(savings)}</span>
                )
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
