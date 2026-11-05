import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { ChevronDownIcon } from '@/components/icons';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '@/hooks/useCurrency';
import { usePromoDiscount } from '@/hooks/usePromoDiscount';
import type { Tariff } from '@/types';
import {
  canBuyMoreDevices,
  longPeriodMonthly,
  tariffHeadlinePrice,
  trafficPeriod,
} from '@/utils/tariffCard';
import type { TariffActionKind } from './tariffAction';
import { TariffFeatureIcon } from './TariffCommonFeatures';

const TARIFF_ACTION_LABEL: Record<Exclude<TariffActionKind, 'current-daily' | 'switch'>, string> = {
  extend: 'subscription.extend',
  moveToTariff: 'subscription.cta.moveToTariff',
  purchase: 'subscription.purchase',
};

interface TariffAccordionCardProps {
  tariff: Tariff;
  open: boolean;
  onToggle: () => void;
  isCurrent: boolean;
  isBestPerDevice: { perDeviceKopeks: number } | null;
  action: TariffActionKind;
  switchSelection: boolean;
  onSelect: () => void;
  onSwitch: () => void;
}

function Benefit({
  icon,
  tone,
  children,
}: {
  icon: string;
  tone?: 'gold' | 'green';
  children: ReactNode;
}) {
  const colors =
    tone === 'gold'
      ? 'border border-urgent-400/35 bg-urgent-400/15 text-urgent-400'
      : tone === 'green'
        ? 'bg-success-400/10 text-success-400'
        : 'bg-accent-500/10 text-accent-400';
  return (
    <li className="flex items-center gap-3">
      <span
        className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] ${colors}`}
      >
        <TariffFeatureIcon icon={icon} />
      </span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

export function TariffAccordionCard({
  tariff,
  open,
  onToggle,
  isCurrent,
  isBestPerDevice,
  action,
  switchSelection,
  onSelect,
  onSwitch,
}: TariffAccordionCardProps) {
  const { t } = useTranslation();
  const { formatAmount, currencySymbol } = useCurrency();
  const { applyPromoDiscount } = usePromoDiscount();
  const bodyId = useId();
  const headerRef = useRef<HTMLButtonElement>(null);
  const headerTopBeforeToggle = useRef<number | null>(null);
  const headline = tariffHeadlinePrice(tariff, applyPromoDiscount);
  const savings = longPeriodMonthly(tariff, applyPromoDiscount);
  const maxDevices = canBuyMoreDevices(tariff);
  const formatPrice = (kopeks: number) =>
    kopeks === 0
      ? t('subscription.free', 'Бесплатно')
      : `${formatAmount(kopeks / 100, currencySymbol === '₽' && kopeks % 100 === 0 ? 0 : 2)}\u00A0${currencySymbol}`;
  const priceLabel =
    headline.kind === 'month'
      ? t('subscription.tariffCard.perMonth')
      : headline.kind === 'daily'
        ? t('subscription.tariffCard.perDay')
        : headline.kind === 'period'
          ? t('subscription.tariffCard.perPeriod', { count: headline.days })
          : t('subscription.tariff.flexiblePayment');

  const toggle = () => {
    headerTopBeforeToggle.current = headerRef.current?.getBoundingClientRect().top ?? null;
    onToggle();
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: open triggers measuring after this header was toggled, as in FaqItem
  useLayoutEffect(() => {
    const before = headerTopBeforeToggle.current;
    headerTopBeforeToggle.current = null;
    if (before === null || !headerRef.current) return;
    const delta = Math.round(headerRef.current.getBoundingClientRect().top - before);
    if (delta !== 0) window.scrollBy({ top: delta, behavior: 'instant' });
  }, [open]);

  return (
    <article
      className={`bento-card min-w-0 p-0 ${open ? 'border-2 !border-accent-500' : 'border border-dark-700/50'}`}
    >
      <button
        ref={headerRef}
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={toggle}
        className="flex w-full items-center gap-2 rounded-2xl p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
      >
        <span className="min-w-0 flex-1">
          {isCurrent ? (
            <span className="badge-success mb-2 inline-flex text-xs">
              {t('subscription.tariffCard.current')}
            </span>
          ) : tariff.is_highlighted ? (
            <span className="mb-2 inline-flex items-center gap-1 rounded-lg bg-urgent-400/15 px-2 py-1 text-xs font-bold text-urgent-400">
              <TariffFeatureIcon icon="star" />
              {t('subscription.tariffCard.popular')}
            </span>
          ) : null}
          <span className="block break-words text-[19px] font-extrabold leading-tight text-dark-50">
            {tariff.name}
          </span>
          {tariff.tagline && (
            <span className="mt-1 block break-words text-sm text-dark-400">{tariff.tagline}</span>
          )}
        </span>
        <span className="max-w-[45%] shrink-0 text-right">
          {headline.kind !== 'flexible' && (
            <span className="block whitespace-nowrap font-display text-[21px] font-bold text-dark-50">
              {formatPrice(headline.quote.price)}
            </span>
          )}
          <span className="block text-xs text-dark-400">{priceLabel}</span>
        </span>
        <span aria-hidden="true">
          <ChevronDownIcon
            className={`h-4 w-4 shrink-0 text-dark-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>
      {open && (
        <div id={bodyId} className="mx-4 border-t border-dark-700/50 pb-4 pt-4">
          <ul className="space-y-3 text-[14.5px] text-dark-200">
            <Benefit icon="devices">
              <b>
                {tariff.device_limit === 0
                  ? '∞'
                  : t('subscription.devices', { count: tariff.device_limit })}
              </b>
              {maxDevices !== null && (
                <>
                  {' '}
                  ·{' '}
                  <span className="whitespace-nowrap text-dark-400">
                    {t('subscription.tariffCard.moreDevices', { count: maxDevices })}
                  </span>
                </>
              )}
            </Benefit>
            {Boolean(tariff.speed_limit_mbps) && (
              <Benefit icon="speed">
                <b>{t('subscription.tariffCard.dedicatedSpeed')}</b>{' '}
                <span className="whitespace-nowrap">
                  {t('subscription.tariffCard.speed', { speed: tariff.speed_limit_mbps })}
                </span>
              </Benefit>
            )}
            {tariff.traffic_limit_gb > 0 && (
              <Benefit icon="traffic">
                <b>{t('subscription.tariffCard.traffic', { gb: tariff.traffic_limit_gb })}</b>{' '}
                <span>
                  {t(
                    `subscription.tariffCard.trafficPeriod.${trafficPeriod(tariff.traffic_reset_mode)}`,
                  )}
                </span>
              </Benefit>
            )}
            {tariff.has_premium_servers && (
              <Benefit icon="premium" tone="gold">
                <b className="text-urgent-400">{t('subscription.tariffCard.premium')}</b>
              </Benefit>
            )}
            {isBestPerDevice && (
              <Benefit icon="value" tone="green">
                <span className="text-success-400">
                  <b>
                    {t('subscription.tariffCard.perDevice', {
                      price: formatPrice(isBestPerDevice.perDeviceKopeks),
                    })}
                  </b>{' '}
                  <span>· {t('subscription.tariffCard.bestPerDevice')}</span>
                </span>
              </Benefit>
            )}
          </ul>
          {!tariff.tagline && tariff.description && (
            <p className="mt-4 whitespace-pre-line text-sm text-dark-400">{tariff.description}</p>
          )}
          <div className="mb-4 mt-5 border-t border-dark-700/50 pt-4">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              {headline.kind !== 'flexible' && (
                <span className="whitespace-nowrap font-display text-[32px] font-bold text-dark-50">
                  {formatPrice(headline.quote.price)}
                </span>
              )}
              <span className="text-sm text-dark-400">{priceLabel}</span>
              {headline.kind !== 'flexible' && (
                <>
                  {headline.quote.original != null &&
                    headline.quote.original > headline.quote.price && (
                      <span className="text-sm text-dark-500 line-through">
                        {formatPrice(headline.quote.original)}
                      </span>
                    )}
                  {headline.quote.percent != null && headline.quote.percent > 0 && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${headline.quote.isPromoGroup ? 'bg-success-400/15 text-success-400' : 'bg-urgent-400/15 text-urgent-400'}`}
                    >
                      -{headline.quote.percent}%
                    </span>
                  )}
                </>
              )}
            </div>
            {savings && (
              <p className="mt-1 text-sm text-success-400">
                {t('subscription.tariffCard.longPeriod', {
                  price: formatPrice(savings.perMonthKopeks),
                  count: savings.months,
                })}
              </p>
            )}
          </div>
          {action === 'current-daily' ? (
            <p className="py-2 text-center text-sm text-dark-500">
              {t('subscription.currentTariff')}
            </p>
          ) : action === 'switch' ? (
            <button
              type="button"
              onClick={onSwitch}
              className="btn-primary w-full"
              aria-label={
                switchSelection
                  ? `${tariff.name}: ${t('subscription.switchTariff.choose')}`
                  : undefined
              }
            >
              {t(
                switchSelection
                  ? 'subscription.switchTariff.choose'
                  : 'subscription.switchTariff.switch',
              )}
            </button>
          ) : (
            <button type="button" onClick={onSelect} className="btn-primary w-full">
              {t(TARIFF_ACTION_LABEL[action])}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
