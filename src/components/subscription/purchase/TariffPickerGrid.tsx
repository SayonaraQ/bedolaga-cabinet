import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useTheme } from '../../../hooks/useTheme';
import { usePromoDiscount } from '../../../hooks/usePromoDiscount';
import { getGlassColors } from '../../../utils/glassTheme';
import { GiftIcon } from '@/components/icons';
import type { Tariff, Subscription, PurchaseOptions } from '../../../types';
import { bestPerDeviceTariff, initialOpenTariffId } from '@/utils/tariffCard';
import { tariffAction } from './tariffAction';
import { TariffAccordionCard } from './TariffAccordionCard';
import { TariffCommonFeatures } from './TariffCommonFeatures';

export interface TariffPickerGridProps {
  tariffs: Tariff[];
  subscription: Subscription | null;
  purchaseOptions: PurchaseOptions | undefined;
  isTariffsMode: boolean;
  isMultiTariff: boolean;
  subscriptionId?: number;
  switchSelection?: boolean;
  onSelectTariff: (tariff: Tariff) => void;
  onSwitchTariff: (tariffId: number) => void;
}

export function TariffPickerGrid({
  tariffs,
  subscription,
  purchaseOptions,
  isTariffsMode,
  isMultiTariff,
  subscriptionId,
  switchSelection = false,
  onSelectTariff,
  onSwitchTariff,
}: TariffPickerGridProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const g = getGlassColors(isDark);
  const { applyPromoDiscount } = usePromoDiscount();
  const visible = [...tariffs]
    .filter((tariff) => {
      if (
        isMultiTariff &&
        tariff.is_purchased &&
        !(switchSelection && (tariff.is_current || tariff.id === subscription?.tariff_id))
      )
        return false;
      if (subscription?.is_trial && tariff.name.toLowerCase().includes('trial')) return false;
      return true;
    })
    .sort((a, b) => {
      const aIsCurrent = a.is_current || a.id === subscription?.tariff_id;
      const bIsCurrent = b.is_current || b.id === subscription?.tariff_id;
      if (aIsCurrent && !bIsCurrent) return -1;
      if (!aIsCurrent && bIsCurrent) return 1;
      return 0;
    });
  const [manualOpenId, setManualOpenId] = useState<number | null | undefined>(undefined);
  const openId =
    manualOpenId === undefined ||
    (manualOpenId !== null && !visible.some((tariff) => tariff.id === manualOpenId))
      ? initialOpenTariffId(visible, subscription?.tariff_id, { preferUpgrade: switchSelection })
      : manualOpenId;
  const best = bestPerDeviceTariff(visible, applyPromoDiscount);

  return (
    <>
      {/* Promo group discount banner */}
      {tariffs.some((tariff) => tariff.promo_group_name) && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-success-500/30 bg-success-500/10 p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-500/20 text-success-400">
            <GiftIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-medium text-success-400">
              {t('subscription.promoGroup.yourGroup', {
                name: tariffs.find((tariff) => tariff.promo_group_name)?.promo_group_name,
              })}
            </div>
            <div className="text-xs text-dark-400">
              {t('subscription.promoGroup.personalDiscountsApplied')}
            </div>
          </div>
        </div>
      )}

      {/* Tariff Grid */}
      {isMultiTariff &&
        purchaseOptions &&
        'all_tariffs_purchased' in purchaseOptions &&
        purchaseOptions.all_tariffs_purchased && (
          <div
            className="rounded-2xl border p-6 text-center"
            style={{ background: g.cardBg, borderColor: g.cardBorder }}
          >
            <div className="mb-2 text-3xl">✅</div>
            <h3 className="mb-1 text-lg font-semibold" style={{ color: g.text }}>
              {t('subscription.allTariffsPurchased', 'Все тарифы подключены')}
            </h3>
            <p className="mb-4 text-sm" style={{ color: g.textSecondary }}>
              {t(
                'subscription.allTariffsPurchasedDesc',
                'Вы уже приобрели все доступные тарифы. Продлить подписку можно на странице тарифа.',
              )}
            </p>
            <button
              onClick={() => navigate('/subscriptions')}
              className="rounded-xl bg-accent-500 px-6 py-2.5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-600"
            >
              {t('subscription.backToList', 'Мои подписки')}
            </button>
          </div>
        )}
      <TariffCommonFeatures
        features={
          purchaseOptions && 'common_features' in purchaseOptions
            ? (purchaseOptions.common_features ?? [])
            : []
        }
      />
      <div className="flex flex-col gap-3">
        {visible.map((tariff) => (
          <TariffAccordionCard
            key={tariff.id}
            tariff={tariff}
            open={openId === tariff.id}
            onToggle={() => setManualOpenId(openId === tariff.id ? null : tariff.id)}
            isCurrent={Boolean(tariff.is_current || tariff.id === subscription?.tariff_id)}
            isBestPerDevice={best?.tariffId === tariff.id ? best : null}
            action={tariffAction({
              tariff,
              subscription,
              purchaseOptions,
              isTariffsMode,
              isMultiTariff,
              subscriptionId,
            })}
            switchSelection={switchSelection}
            onSelect={() => onSelectTariff(tariff)}
            onSwitch={() => onSwitchTariff(tariff.id)}
          />
        ))}
      </div>
    </>
  );
}
