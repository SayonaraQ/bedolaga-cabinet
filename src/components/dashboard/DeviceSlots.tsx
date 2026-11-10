import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useHaptic } from '@/platform';
import { Button } from '@/components/primitives/Button';
import { ConnectDeviceButton } from '@/components/ui/ConnectDeviceButton';
import { PlusIcon } from '@/components/icons';
import { useTheme } from '../../hooks/useTheme';
import { getGlassColors } from '../../utils/glassTheme';
import { appLabel, slotDeviceNames, type SlotDevice } from '../../utils/deviceSlots';
import { MultiAppNotes, SlotGrid, SlotIcon, useSlotStatus } from './SlotGrid';

interface DeviceSlotsProps {
  subscription: {
    id: number;
    device_limit: number;
    subscription_url?: string | null;
    is_trial?: boolean;
  };
  devices: SlotDevice[];
}

/**
 * Слоты устройств на главной: ячейка = приложение на устройстве.
 *
 * Заменила плитку «Подключить устройство» с точками. Точки говорили «2 из 3»,
 * но не что занимает слоты, и человек с подпиской в INCY и Happ на одном
 * телефоне не понимал, куда делся слот. А при полном лимите плитка становилась
 * серой и некликабельной — теперь вместо неё путь к управлению устройствами.
 * Сетка общая со страницей подписки (SlotGrid).
 */
export default function DeviceSlots({ subscription, devices }: DeviceSlotsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const haptic = useHaptic();
  const { isDark } = useTheme();
  const g = getGlassColors(isDark);
  const limit = subscription.device_limit;
  const used = devices.length;
  const status = useSlotStatus(limit, used);

  if (!subscription.subscription_url) return null;

  const names = slotDeviceNames(devices);
  const nameOf = (device: SlotDevice) => names.get(device.hwid) ?? device.platform;

  const manage = () => {
    haptic.impact('light');
    // Сразу к разделу «Устройства» на странице подписки: там отключают и переименовывают.
    navigate(`/subscriptions/${subscription.id}#devices`);
  };
  const connect = () => {
    haptic.impact('light');
    navigate(`/connection?sub=${subscription.id}`);
  };

  const single = limit === 1 && used <= 1;

  return (
    <section className="mb-5 flex flex-col gap-3" data-onboarding="connect-devices">
      <div className="flex items-baseline justify-between gap-2 px-0.5">
        <h3 className="text-sm font-semibold tracking-tight text-dark-50">
          {t('dashboard.slots.title')}
        </h3>
        <span
          className={`text-xs font-semibold ${status.isFull ? 'text-warning-400' : 'text-dark-400'}`}
        >
          {status.text}
        </span>
      </div>
      {single ? (
        <div
          className="flex items-center gap-3 rounded-[14px] p-3"
          style={{ background: g.innerBg, border: `1px solid ${g.innerBorder}` }}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-500/10 text-accent-400">
            {devices[0] ? (
              <SlotIcon device={devices[0]} className="h-5 w-5" />
            ) : (
              <PlusIcon className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-bold text-accent-400">
              {devices[0]
                ? (appLabel(devices[0].app) ?? nameOf(devices[0]))
                : t('dashboard.slots.free')}
            </div>
            <div className="mt-0.5 truncate text-xs text-dark-400">
              {devices[0]
                ? `${nameOf(devices[0])} · ${devices[0].platform}`
                : t('dashboard.slots.freeHint')}
            </div>
          </div>
          {devices[0] && (
            <button
              type="button"
              onClick={manage}
              className="shrink-0 rounded-[10px] border border-dark-700/50 bg-dark-800/80 px-3 py-2 text-[13px] font-semibold text-dark-100 transition-colors hover:bg-dark-700/80"
            >
              {t('dashboard.slots.manage')}
            </button>
          )}
        </div>
      ) : (
        <SlotGrid devices={devices} limit={limit} onDeviceClick={manage} onFreeClick={connect} />
      )}

      <MultiAppNotes devices={devices} />

      {/* У триала при занятом слоте большой кнопки нет: его главное действие —
          «Выбрать тариф» в карточке; управлять устройством — «Управлять» в слоте. */}
      {status.isFull ? (
        subscription.is_trial ? null : (
          <Button size="lg" fullWidth className="h-[52px] font-bold" onClick={manage}>
            {t('dashboard.slots.freeUpOrAdd')}
          </Button>
        )
      ) : (
        <ConnectDeviceButton
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl px-6 text-base font-bold"
          onClick={connect}
        >
          <PlusIcon className="h-5 w-5" />
          {t('dashboard.connectDevice')}
        </ConnectDeviceButton>
      )}
    </section>
  );
}
