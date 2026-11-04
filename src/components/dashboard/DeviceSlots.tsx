import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useHaptic } from '@/platform';
import { Button } from '@/components/primitives/Button';
import {
  ExclamationIcon,
  MonitorIcon,
  PhoneIcon,
  PlusIcon,
  TabletIcon,
  TvIcon,
} from '@/components/icons';
import { useTheme } from '../../hooks/useTheme';
import { getGlassColors } from '../../utils/glassTheme';
import {
  appLabel,
  deviceKind,
  deviceName,
  findMultiAppDevices,
  slotGridColumns,
  type DeviceKind,
  type SlotDevice,
} from '../../utils/deviceSlots';

/** Больше слотов рисовать ячейками нет смысла: свободные сворачиваются в одну. */
const MAX_DRAWN_SLOTS = 12;

const KIND_ICON: Record<DeviceKind, (props: { className?: string }) => React.ReactElement> = {
  phone: PhoneIcon,
  tablet: TabletIcon,
  pc: MonitorIcon,
  tv: TvIcon,
};

interface DeviceSlotsProps {
  subscription: {
    id: number;
    device_limit: number;
    subscription_url?: string | null;
    is_trial?: boolean;
  };
  devices: SlotDevice[];
}

/** «INCY и Happ», «INCY, Happ и v2RayTun» — без Intl.ListFormat: библиотека типов проекта старше ES2021. */
function listFormat(items: string[], and: string): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`;
}

/**
 * Слоты устройств на главной: ячейка = приложение на устройстве.
 *
 * Заменила плитку «Подключить устройство» с точками. Точки говорили «2 из 3»,
 * но не что занимает слоты, и человек с подпиской в INCY и Happ на одном
 * телефоне не понимал, куда делся слот. А при полном лимите плитка становилась
 * серой и некликабельной — теперь вместо неё путь к управлению устройствами.
 */
export default function DeviceSlots({ subscription, devices }: DeviceSlotsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const haptic = useHaptic();
  const { isDark } = useTheme();
  const g = getGlassColors(isDark);

  if (!subscription.subscription_url) return null;

  const limit = subscription.device_limit;
  const used = devices.length;
  const unlimited = limit === 0;
  const isFull = !unlimited && used >= limit;
  const free = unlimited ? 0 : Math.max(limit - used, 0);
  const multiApp = findMultiAppDevices(devices);
  const multiAppHwids = new Set(multiApp.flatMap((m) => m.hwids));

  const manage = () => {
    haptic.impact('light');
    navigate(`/subscriptions/${subscription.id}`);
  };
  const connect = () => {
    haptic.impact('light');
    navigate(`/connection?sub=${subscription.id}`);
  };

  const status = unlimited
    ? t('dashboard.devicesConnectedUnlimited', { used })
    : isFull
      ? limit === 1
        ? t('dashboard.slots.oneTaken')
        : t('dashboard.slots.allTaken', { used, max: limit })
      : t('dashboard.slots.usedFree', { used, max: limit, count: free });

  const single = limit === 1 && used <= 1;
  const drawnFree = unlimited ? (used === 0 ? 1 : 0) : free;
  const collapseFree = !unlimited && used + free > MAX_DRAWN_SLOTS;
  const columns = slotGridColumns(unlimited ? Math.max(used, 1) : Math.max(limit, used));

  const renderIcon = (device: SlotDevice, className: string) => {
    const Icon = KIND_ICON[deviceKind(device.platform)];
    return <Icon className={className} />;
  };

  return (
    <section className="mb-5 flex flex-col gap-3" data-onboarding="connect-devices">
      <div className="flex items-baseline justify-between gap-2 px-0.5">
        <h3 className="text-sm font-semibold tracking-tight text-dark-50">
          {t('dashboard.slots.title')}
        </h3>
        <span className={`text-xs font-semibold ${isFull ? 'text-warning-400' : 'text-dark-400'}`}>
          {status}
        </span>
      </div>
      <p className="-mt-1.5 px-0.5 text-[11px] leading-snug text-dark-400">
        {t('dashboard.slots.legend')}
      </p>

      {single ? (
        <div
          className="flex items-center gap-3 rounded-[14px] p-3"
          style={{ background: g.innerBg, border: `1px solid ${g.innerBorder}` }}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-500/10 text-accent-400">
            {devices[0] ? renderIcon(devices[0], 'h-5 w-5') : <PlusIcon className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-bold text-accent-400">
              {devices[0]
                ? (appLabel(devices[0].app) ?? deviceName(devices[0]))
                : t('dashboard.slots.free')}
            </div>
            <div className="mt-0.5 truncate text-xs text-dark-400">
              {devices[0]
                ? `${deviceName(devices[0])} · ${devices[0].platform}`
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
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {devices.map((device) => {
            const app = appLabel(device.app);
            const name = deviceName(device);
            const twin = multiAppHwids.has(device.hwid);
            return (
              <button
                key={device.hwid}
                type="button"
                onClick={manage}
                className="flex min-h-[86px] min-w-0 flex-col items-center justify-center gap-1 rounded-[14px] px-1 py-2 text-center transition-colors"
                style={{
                  background: g.innerBg,
                  border: twin
                    ? '1.5px solid rgba(var(--color-warning-500), 0.55)'
                    : `1px solid ${g.innerBorder}`,
                }}
              >
                {renderIcon(device, 'h-[18px] w-[18px] text-dark-400')}
                <span className="max-w-full break-words text-xs font-extrabold leading-tight text-accent-400 [overflow-wrap:anywhere]">
                  {app ?? name}
                </span>
                {app && (
                  <span className="max-w-full break-words text-[10px] font-semibold leading-tight text-dark-400 [overflow-wrap:anywhere]">
                    {name}
                  </span>
                )}
              </button>
            );
          })}
          {collapseFree ? (
            <button
              type="button"
              onClick={connect}
              className="flex min-h-[86px] flex-col items-center justify-center gap-1.5 rounded-[14px] text-accent-400"
              style={{ border: '1.5px dashed rgba(var(--color-accent-500), 0.4)' }}
            >
              <PlusIcon className="h-5 w-5" />
              <span className="text-[10px] font-semibold">
                {t('dashboard.slots.moreFree', { count: free })}
              </span>
            </button>
          ) : (
            Array.from({ length: drawnFree }, (_, i) => (
              <button
                key={`free-${i}`}
                type="button"
                onClick={connect}
                className="flex min-h-[86px] flex-col items-center justify-center gap-1.5 rounded-[14px] text-accent-400"
                style={{ border: '1.5px dashed rgba(var(--color-accent-500), 0.4)' }}
              >
                <PlusIcon className="h-5 w-5" />
                <span className="text-[10px] font-semibold">{t('dashboard.slots.free')}</span>
              </button>
            ))
          )}
        </div>
      )}

      {multiApp.map((group) => (
        <div
          key={group.hwids.join(',')}
          className="flex items-start gap-2.5 rounded-[14px] border border-warning-500/40 bg-warning-500/10 p-3"
        >
          <ExclamationIcon className="mt-0.5 h-4 w-4 shrink-0 text-warning-400" />
          <p className="text-xs leading-relaxed text-dark-100">
            {t('dashboard.slots.multiApp', {
              model: group.model,
              count: group.hwids.length,
              apps: listFormat(group.apps, t('dashboard.slots.and')),
            })}
          </p>
        </div>
      ))}

      {isFull ? (
        <Button size="lg" fullWidth className="h-[52px] font-bold" onClick={manage}>
          {subscription.is_trial ? t('dashboard.slots.freeUp') : t('dashboard.slots.freeUpOrAdd')}
        </Button>
      ) : (
        <Button size="lg" fullWidth className="h-[52px] font-bold" onClick={connect}>
          <PlusIcon className="h-5 w-5" />
          {t('dashboard.connectDevice')}
        </Button>
      )}
    </section>
  );
}
