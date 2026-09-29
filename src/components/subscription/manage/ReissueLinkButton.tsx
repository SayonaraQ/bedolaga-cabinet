import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { subscriptionApi } from '@/api/subscription';
import { RevokeSubscriptionSheet } from '@/components/subscription/sheets/RevokeSubscriptionSheet';
import { useTheme } from '@/hooks/useTheme';
import { useHaptic } from '@/platform';
import type { Subscription } from '@/types';
import { getGlassColors } from '@/utils/glassTheme';
import { safeLocal } from '@/utils/safeStorage';
import { getErrorMessage } from '@/utils/subscriptionHelpers';

/** Пауза между перевыпусками, секунды. Ограничение панели, не наше. */
const REVOKE_COOLDOWN_SECONDS = 900;

/**
 * Есть ли что перевыпускать.
 *
 * Экспортируется отдельно, потому что вызывающий экран рисует вокруг кнопки
 * свою подложку: без этой проверки у пробной подписки оставалась бы пустая
 * карточка от блока, которого нет.
 */
export function canReissueLink(
  subscription: Pick<Subscription, 'is_active' | 'is_limited' | 'is_trial'>,
): boolean {
  return (subscription.is_active || subscription.is_limited) && !subscription.is_trial;
}

export interface ReissueLinkButtonProps {
  subscription: Subscription;
  subscriptionId: number | undefined;
  /** Сколько устройств отвалится — для текста последствий. 0 — общая формулировка. */
  connectedDevices?: number;
}

/**
 * Перевыпуск ссылки подписки.
 *
 * Вынесен из тела страницы подписки, чтобы им мог пользоваться простой вид.
 * Действие разрушительное: панель сбрасывает привязки устройств, поэтому
 * подтверждение и пауза в 15 минут — часть компонента, а не вызывающего
 * экрана. Подтверждение — RevokeSubscriptionSheet (в странице, с чекбоксом),
 * а не useDestructiveConfirm: тот в браузере падает в window.confirm,
 * который жмут рефлексом, не читая. Отсчёт паузы переживает перезагрузку:
 * метка времени лежит в хранилище, иначе человек обходил бы ограничение обновлением страницы.
 *
 * Возвращает null там, где перевыпускать нечего: у пробных и у неактивных.
 */
export function ReissueLinkButton({
  subscription,
  subscriptionId,
  connectedDevices = 0,
}: ReissueLinkButtonProps) {
  const queryClient = useQueryClient();
  const haptic = useHaptic();
  const { isDark } = useTheme();
  const g = getGlassColors(isDark);
  const [sheetOpen, setSheetOpen] = useState(false);
  const storageKey = `revoke_ts_${subscriptionId ?? 'default'}`;

  const [cooldown, setCooldown] = useState(() => {
    const last = Number(safeLocal.getItem(storageKey) || '0');
    if (!last) return 0;
    const passed = Math.floor((Date.now() - last) / 1000);
    return Math.max(0, REVOKE_COOLDOWN_SECONDS - passed);
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const revokeMutation = useMutation({
    mutationFn: () => subscriptionApi.revokeSubscription(subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['connection-link', subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      // Remnawave resets device HWIDs on revoke — make sure the cabinet
      // re-reads the now-empty device list instead of showing the stale cache.
      queryClient.invalidateQueries({ queryKey: ['devices', subscriptionId] });
      haptic.notification('success');
      safeLocal.setItem(storageKey, Date.now().toString());
      setCooldown(REVOKE_COOLDOWN_SECONDS);
    },
    onError: () => {
      haptic.notification('error');
    },
  });

  if (!canReissueLink(subscription)) return null;

  return (
    <>
      <RevokeSubscriptionSheet
        open={sheetOpen}
        onOpen={() => setSheetOpen(true)}
        onClose={() => setSheetOpen(false)}
        onConfirm={() => {
          setSheetOpen(false);
          revokeMutation.mutate();
        }}
        isPending={revokeMutation.isPending}
        cooldownSeconds={cooldown}
        connectedDevices={connectedDevices}
        textSecondary={g.textSecondary}
      />
      {revokeMutation.error && (
        <p className="mt-2 text-sm text-error-400">{getErrorMessage(revokeMutation.error)}</p>
      )}
    </>
  );
}

export default ReissueLinkButton;
