import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { subscriptionApi } from '@/api/subscription';
import { MultiAppNotes, SlotGrid, useSlotStatus } from '@/components/dashboard/SlotGrid';
import { CheckIcon, XIcon } from '@/components/icons';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';
import { DEVICE_ALIAS_MAX_LENGTH } from '@/constants/devices';
import { useHaptic } from '@/platform';
import { useDestructiveConfirm } from '@/platform/hooks/useNativeDialog';
import { appLabel, slotDeviceNames, type SlotDevice } from '@/utils/deviceSlots';
import { uiLocale } from '@/utils/uiLocale';

export interface DeviceSlotsPanelProps {
  subscriptionId: number | undefined;
  deviceLimit: number;
  /** «＋ Добавить слот» — есть только там, где страница умеет докупать устройства. */
  onAddSlot?: () => void;
  /** «− Уменьшить» — есть только там, где страница умеет уменьшать лимит. */
  onReduce?: () => void;
  /** Нажатие на свободный слот. */
  onConnect?: () => void;
}

// Кнопки всегда делят ряд поровну (решение владельца 05.11.2026: переносить
// текст, а не сдвигать кнопки). На 320–360 px подпись переносится внутри кнопки
// целыми словами; без nowrap «Уменьшить» больше не вылезает за край карточки.
const SOFT_BUTTON =
  'inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-accent-500/35 bg-accent-500/10 px-2.5 py-1.5 text-center text-[13px] font-bold leading-tight text-accent-400 transition-colors hover:bg-accent-500/15';

/**
 * Раздел «Устройства» страницы подписки (макет 05.11.2026).
 *
 * Те же слоты «приложение · устройство», что на главной (SlotGrid), но нажатие
 * не уводит, а открывает устройство на месте: переименовать или отключить.
 * Заменил три места страницы — «Докупить / Уменьшить устройства» в
 * «Дополнительных опциях» и нижний список «Мои устройства».
 *
 * Запрос устройств делит ключ ['devices', id] со страницей и главной.
 * Полный HWID остаётся в карточке устройства выделяемым текстом — его просит поддержка.
 */
export function DeviceSlotsPanel({
  subscriptionId,
  deviceLimit,
  onAddSlot,
  onReduce,
  onConnect,
}: DeviceSlotsPanelProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const haptic = useHaptic();
  const destructiveConfirm = useDestructiveConfirm();
  const [selectedHwid, setSelectedHwid] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['devices', subscriptionId],
    queryFn: () => subscriptionApi.getDevices(subscriptionId),
  });
  const devices: SlotDevice[] = data?.devices ?? [];
  const status = useSlotStatus(deviceLimit, devices.length);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['devices', subscriptionId] });

  const deleteMutation = useMutation({
    mutationFn: (hwid: string) => subscriptionApi.deleteDevice(hwid, subscriptionId),
    onSuccess: () => {
      setSelectedHwid(null);
      invalidate();
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => subscriptionApi.deleteAllDevices(subscriptionId),
    onSuccess: () => {
      setSelectedHwid(null);
      invalidate();
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ hwid, name }: { hwid: string; name: string | null }) =>
      subscriptionApi.renameDevice(hwid, name, subscriptionId),
    onSuccess: () => {
      invalidate();
      haptic.notification('success');
      setRenaming(false);
    },
    onError: () => haptic.notification('error'),
  });

  const names = slotDeviceNames(devices);
  const selected = devices.find((d) => d.hwid === selectedHwid) ?? null;

  const select = (device: SlotDevice) => {
    haptic.impact('light');
    setRenaming(false);
    setSelectedHwid((current) => (current === device.hwid ? null : device.hwid));
  };

  const disconnect = async (device: SlotDevice) => {
    const confirmed = await destructiveConfirm(
      t('subscription.confirmDeleteDevice'),
      t('subscription.deleteDevice'),
      t('subscription.deleteDevice'),
    );
    if (confirmed) deleteMutation.mutate(device.hwid);
  };

  const saveName = () => {
    if (!selected) return;
    const trimmed = newName.trim();
    renameMutation.mutate({ hwid: selected.hwid, name: trimmed || null });
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-bold tracking-tight text-dark-50">
          {t('subscription.devicesSection.title')}
        </h2>
        <span
          className={`text-xs font-semibold ${status.isFull ? 'text-warning-400' : 'text-dark-400'}`}
        >
          {status.text}
        </span>
      </div>

      {isLoading ? (
        <SkeletonGroup className="grid grid-cols-3 gap-2">
          <Skeleton variant="card" count={3} className="h-[86px]" />
        </SkeletonGroup>
      ) : (
        <SlotGrid
          devices={devices}
          limit={deviceLimit}
          selectedHwid={selectedHwid}
          onDeviceClick={select}
          onFreeClick={() => onConnect?.()}
        />
      )}

      {selected ? (
        <div className="flex flex-col gap-3 rounded-[14px] border border-dark-700/40 bg-dark-800/40 p-3.5">
          {renaming ? (
            <div className="flex items-center gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={DEVICE_ALIAS_MAX_LENGTH}
                placeholder={names.get(selected.hwid) ?? selected.platform}
                aria-label={t('subscription.devicesSection.rename')}
                className="min-w-0 flex-1 rounded-lg border border-dark-700/50 bg-dark-900/60 px-3 py-2 text-sm text-dark-50 outline-none focus:ring-1 focus:ring-accent-500/50"
              />
              <button
                type="button"
                onClick={saveName}
                disabled={renameMutation.isPending}
                aria-label={t('subscription.renameDeviceSave', 'Сохранить')}
                className="rounded-lg p-2 text-success-400 hover:bg-dark-700/50 disabled:opacity-50"
              >
                <CheckIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setRenaming(false)}
                aria-label={t('subscription.renameDeviceCancel', 'Отмена')}
                className="rounded-lg p-2 text-dark-400 hover:bg-dark-700/50"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="min-w-0">
              <div className="break-words text-[15px] font-bold text-dark-50">
                {[appLabel(selected.app), names.get(selected.hwid)].filter(Boolean).join(' · ')}
              </div>
              <div className="mt-0.5 text-xs text-dark-400">
                {selected.created_at
                  ? t('subscription.devicesSection.addedOn', {
                      platform: selected.platform,
                      date: new Date(selected.created_at).toLocaleDateString(uiLocale(), {
                        day: 'numeric',
                        month: 'long',
                      }),
                    })
                  : selected.platform}
              </div>
              <div className="mt-1 select-all break-all font-mono text-[11px] text-dark-400">
                {selected.hwid}
              </div>
            </div>
          )}
          {!renaming && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setNewName(selected.local_name ?? '');
                  setRenaming(true);
                }}
                className="h-10 flex-1 rounded-[10px] border border-dark-700/50 bg-dark-800/80 text-sm font-semibold text-dark-100 transition-colors hover:bg-dark-700/80"
              >
                {t('subscription.devicesSection.rename')}
              </button>
              <button
                type="button"
                onClick={() => disconnect(selected)}
                disabled={deleteMutation.isPending}
                className="h-10 flex-1 rounded-[10px] border border-error-500/30 bg-error-500/10 text-sm font-bold text-error-400 transition-colors hover:bg-error-500/20 disabled:opacity-50"
              >
                {t('subscription.devicesSection.disconnect')}
              </button>
            </div>
          )}
        </div>
      ) : (
        devices.length > 0 && (
          <p className="text-xs text-dark-400">{t('subscription.devicesSection.hint')}</p>
        )
      )}

      <MultiAppNotes devices={devices} />

      {(onAddSlot || onReduce) && (
        <div className="flex gap-2">
          {onAddSlot && (
            <button type="button" onClick={onAddSlot} className={SOFT_BUTTON}>
              {t('subscription.devicesSection.addSlot')}
            </button>
          )}
          {onReduce && (
            <button type="button" onClick={onReduce} className={SOFT_BUTTON}>
              {t('subscription.devicesSection.reduce')}
            </button>
          )}
        </div>
      )}

      {devices.length > 1 && (
        <button
          type="button"
          onClick={async () => {
            const confirmed = await destructiveConfirm(
              t('subscription.confirmDeleteAllDevices'),
              t('subscription.deleteAllDevices'),
              t('subscription.deleteAllDevices'),
            );
            if (confirmed) deleteAllMutation.mutate();
          }}
          disabled={deleteAllMutation.isPending}
          className="inline-flex min-h-[38px] w-full items-center justify-center rounded-[10px] border border-error-500/35 bg-error-500/10 px-2.5 py-1.5 text-center text-[13px] font-bold leading-tight text-error-400 transition-colors hover:bg-error-500/15 disabled:opacity-50"
        >
          {t('subscription.devicesSection.disconnectAll')}
        </button>
      )}
    </section>
  );
}
