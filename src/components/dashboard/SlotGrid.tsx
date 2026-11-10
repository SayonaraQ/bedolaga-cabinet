import { useTranslation } from 'react-i18next';
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
  findMultiAppDevices,
  slotDeviceNames,
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

export function SlotIcon({ device, className }: { device: SlotDevice; className: string }) {
  const Icon = KIND_ICON[deviceKind(device.platform)];
  return <Icon className={className} />;
}

/** «2 из 3 · 1 свободен» / «все заняты» / «без лимита» — одинаково на главной и в подписке. */
export function useSlotStatus(limit: number, used: number) {
  const { t } = useTranslation();
  const unlimited = limit === 0;
  const isFull = !unlimited && used >= limit;
  const free = unlimited ? 0 : Math.max(limit - used, 0);
  const text = unlimited
    ? t('dashboard.devicesConnectedUnlimited', { used })
    : isFull
      ? limit === 1
        ? t('dashboard.slots.oneTaken')
        : t('dashboard.slots.allTaken', { used, max: limit })
      : t('dashboard.slots.usedFree', { used, max: limit, count: free });
  return { text, isFull, free, unlimited };
}

interface SlotGridProps {
  devices: SlotDevice[];
  /** Лимит устройств; 0 — без лимита. */
  limit: number;
  selectedHwid?: string | null;
  onDeviceClick: (device: SlotDevice) => void;
  onFreeClick: () => void;
}

/**
 * Сетка слотов: ячейка = приложение на устройстве. До трёх слотов в ряд, дальше
 * по четыре; ячейки одного телефона в разных приложениях подсвечены жёлтым
 * (цвет предупреждения: владелец 11.11 — голубой не бросается в глаза).
 * Общая для главной (нажатие уводит к устройствам) и страницы подписки
 * (нажатие открывает устройство на месте).
 */
export function SlotGrid({
  devices,
  limit,
  selectedHwid,
  onDeviceClick,
  onFreeClick,
}: SlotGridProps) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const g = getGlassColors(isDark);

  const used = devices.length;
  const unlimited = limit === 0;
  const free = unlimited ? 0 : Math.max(limit - used, 0);
  const multiAppHwids = new Set(findMultiAppDevices(devices).flatMap((m) => m.hwids));
  // У всех HWID одного телефона — одно имя: INCY пишет «Xiaomi 25102PCBEG», Happ — «25102PCBEG».
  const names = slotDeviceNames(devices);
  const drawnFree = unlimited ? (used === 0 ? 1 : 0) : free;
  const collapseFree = !unlimited && used + free > MAX_DRAWN_SLOTS;
  const columns = slotGridColumns(unlimited ? Math.max(used, 1) : Math.max(limit, used));

  const freeCell = (key: string, label: string) => (
    <button
      key={key}
      type="button"
      onClick={onFreeClick}
      className="flex min-h-[86px] flex-col items-center justify-center gap-1.5 rounded-[14px] text-accent-400"
      style={{ border: '1.5px dashed rgba(var(--color-accent-500), 0.4)' }}
    >
      <PlusIcon className="h-5 w-5" />
      <span className="text-[10px] font-semibold">{label}</span>
    </button>
  );

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {devices.map((device) => {
        const app = appLabel(device.app);
        const name = names.get(device.hwid) ?? device.platform;
        const selected = device.hwid === selectedHwid;
        const twin = multiAppHwids.has(device.hwid);
        return (
          <button
            key={device.hwid}
            type="button"
            aria-pressed={selectedHwid === undefined ? undefined : selected}
            onClick={() => onDeviceClick(device)}
            className="flex min-h-[86px] min-w-0 flex-col items-center justify-center gap-1 rounded-[14px] px-1 py-2 text-center transition-colors"
            style={{
              background: selected ? 'rgba(var(--color-accent-500), 0.1)' : g.innerBg,
              border: selected
                ? '1.5px solid rgb(var(--color-accent-500))'
                : twin
                  ? '1.5px solid rgba(var(--color-warning-500), 0.55)'
                  : `1px solid ${g.innerBorder}`,
            }}
          >
            <SlotIcon
              device={device}
              className={`h-[18px] w-[18px] ${selected ? 'text-accent-400' : 'text-dark-400'}`}
            />
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
      {collapseFree
        ? freeCell('free-more', t('dashboard.slots.moreFree', { count: free }))
        : Array.from({ length: drawnFree }, (_, i) =>
            freeCell(`free-${i}`, t('dashboard.slots.free')),
          )}
    </div>
  );
}

/** «AA, BB и CC» — без Intl.ListFormat: библиотека типов проекта старше ES2021. */
function listFormat(items: string[], and: string): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`;
}

/** «POCO F8 Ultra занимает 2 слота: подписка добавлена в INCY и Happ…» */
export function MultiAppNotes({ devices }: { devices: SlotDevice[] }) {
  const { t } = useTranslation();
  return (
    <>
      {findMultiAppDevices(devices).map((group) => (
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
    </>
  );
}
