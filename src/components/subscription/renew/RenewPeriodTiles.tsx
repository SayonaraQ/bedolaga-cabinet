import { useTranslation } from 'react-i18next';
import { useCurrency } from '@/hooks/useCurrency';
import { useTheme } from '@/hooks/useTheme';
import type { RenewalOption } from '@/types';
import { getGlassColors } from '@/utils/glassTheme';
import { periodLabel, periodSavingsKopeks, periodUnitPrice } from '@/utils/renew/renewPlan';
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
      className={`grid gap-2 pt-2.5 ${columns}`}
      role="radiogroup"
      aria-label={t('subscription.renewPage.periodHeading')}
    >
      {options.map((option) => {
        const selected = selectedDays === option.period_days;
        const highlighted = Boolean(option.is_highlighted);
        const label = periodLabel(option.period_days);
        const savings = periodSavingsKopeks(option, options);
        const promo = (option.original_price_kopeks ?? 0) > option.price_kopeks;
        const unitPrice = periodUnitPrice(option);
        const chip = promo
          ? option.discount_percent > 0
            ? `-${option.discount_percent}%`
            : null
          : savings > 0
            ? `−${money(savings)}`
            : null;

        return (
          <button
            key={option.period_days}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onSelect(option.period_days)}
            className={`glass-card relative flex min-w-0 flex-col items-center justify-center rounded-linear-lg px-2 pb-3 pt-4 text-center transition-colors disabled:opacity-50 ${highlighted ? 'border-2' : 'border'}`}
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
            {promo && (
              <span className="text-[11px] text-dark-400 line-through">
                {money(option.original_price_kopeks ?? 0)}
              </span>
            )}
            {/* Цена за месяц у каждого срока: по ней видно, что длинный срок дешевле,
                и у первой плитки нет пустой строки. На узких экранах единица
                уходит второй строкой, иначе «₽/мес» ломалось посередине. */}
            {unitPrice && (
              <span className={`mt-1.5 text-xs ${selected ? 'text-accent-300' : 'text-dark-400'}`}>
                <span className="whitespace-nowrap">{money(unitPrice.kopeks)}</span>
                <span className="hidden min-[360px]:inline">
                  {t(
                    `subscription.renewPage.${unitPrice.unit === 'month' ? 'perMonthShort' : 'perDayShort'}`,
                  )}
                </span>
                <span className="block text-[10px] min-[360px]:hidden">
                  {t(
                    `subscription.renewPage.${unitPrice.unit === 'month' ? 'perMonthLong' : 'perDayLong'}`,
                  )}
                </span>
              </span>
            )}
            {/* Отметка оператора визуально первой строкой, но в DOM после срока:
                имя кнопки для скринридера начинается со срока, а не с «Выгодно».
                Уже 360 px слово в плитку не влезает — остаётся звезда, текст
                для скринридера на месте (нулевой кегль, не display:none). */}
            {highlighted && (
              <BestValueBadge className="order-first mb-1.5 whitespace-nowrap px-1.5 tracking-normal max-[359px]:gap-0 max-[359px]:text-[0px]" />
            )}
            {/* Выгода — ярлыком на углу, как ценник со скидкой. */}
            {chip && (
              <span className="absolute -top-2.5 right-2 z-10 whitespace-nowrap rounded-full bg-success-500 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
                {chip}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
