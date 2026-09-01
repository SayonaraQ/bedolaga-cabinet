import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// ──────────────────────────────────────────────────────────────────
// Перевыпуск подписки: кнопка + подтверждение.
//
// Действие необратимо — панель выдаёт новую ссылку, гасит старую и
// сбрасывает HWID всех устройств. Раньше веб подтверждал его через
// useDestructiveConfirm, который на не-Telegram платформах падает в
// window.confirm: системная плашка браузера, неотличимая от «разрешить
// уведомления», и её жали рефлексом, не читая.
//
// Поэтому подтверждение рисуется внутри страницы по домашнему образцу
// DeleteSubscriptionSheet, и к нему добавлен явный чекбокс: осознанное
// «понимаю» нельзя проскочить мышечной памятью «Enter по кнопке по
// умолчанию», как проскакивали OK.
//
// Платформа здесь НЕ разветвляется, в отличие от DeleteSubscriptionSheet.
// Нативный popup Telegram выглядит иначе, чем браузерная плашка, но ведёт
// себя так же: одно касание по красной кнопке — и устройства сброшены.
// Проблема была не в чужом хроме, а в отсутствии барьера, поэтому барьер
// стоит на всех платформах одинаково.
//
// Мутацию компонент не владеет: перевыпуск инвалидирует полстраницы и
// заводит 15-минутный кулдаун, это дело родителя. Сюда приходят готовые
// isPending / cooldownSeconds и колбэк onConfirm.
// ──────────────────────────────────────────────────────────────────

export interface RevokeSubscriptionSheetProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  /** Запускает саму мутацию перевыпуска. */
  onConfirm: () => void;
  isPending: boolean;
  /** Секунды до конца кулдауна; 0 — кнопка активна. */
  cooldownSeconds: number;
  /** Сколько устройств отвалится — попадает в текст последствий. */
  connectedDevices: number;
  /** Цвет вторичного текста, уже разрешённый из glassTheme. */
  textSecondary: string;
}

export function RevokeSubscriptionSheet({
  open,
  onOpen,
  onClose,
  onConfirm,
  isPending,
  cooldownSeconds,
  connectedDevices,
  textSecondary,
}: RevokeSubscriptionSheetProps) {
  const { t } = useTranslation();
  const [acknowledged, setAcknowledged] = useState(false);

  const onCooldown = cooldownSeconds > 0;

  const handleClose = () => {
    // Согласие живёт ровно одну сессию панели: закрыл — подтверждай заново.
    setAcknowledged(false);
    onClose();
  };

  if (!open) {
    return (
      <button
        onClick={onOpen}
        disabled={isPending || onCooldown}
        className="w-full rounded-xl border border-warning-500/30 bg-warning-500/10 p-4 text-left transition-colors hover:bg-warning-500/20 disabled:opacity-50"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-warning-400">{t('subscription.revoke.button')}</div>
            <div className="mt-1 text-sm text-dark-400">
              {onCooldown
                ? t('subscription.revoke.cooldown', {
                    minutes: Math.floor(cooldownSeconds / 60),
                    seconds: cooldownSeconds % 60,
                  })
                : t('subscription.revoke.description')}
            </div>
          </div>
          <div className="text-warning-400">
            {isPending ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-warning-400/30 border-t-amber-400" />
            ) : (
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
                />
              </svg>
            )}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-warning-500/25 bg-warning-500/[0.05] p-4">
      <div className="mb-3 text-sm font-semibold text-warning-400">
        {t('subscription.revoke.confirmTitle')}
      </div>

      {/* Последствия в терминах пользователя, а не системы: не «сброс HWID»,
          а «на каждом устройстве придётся добавлять ссылку заново». */}
      <ul
        className="mb-4 flex list-none flex-col gap-1.5 p-0 text-xs"
        style={{ color: textSecondary }}
      >
        <li className="flex gap-2">
          <span aria-hidden className="text-warning-400/60">
            —
          </span>
          <span>{t('subscription.revoke.consequenceLink')}</span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden className="text-warning-400/60">
            —
          </span>
          <span>
            {connectedDevices > 0
              ? t('subscription.revoke.consequenceDevices', { count: connectedDevices })
              : t('subscription.revoke.consequenceDevicesAny')}
          </span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden className="text-warning-400/60">
            —
          </span>
          <span>{t('subscription.revoke.consequenceReconnect')}</span>
        </li>
      </ul>

      <label className="mb-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-dark-50/[0.06] bg-dark-50/[0.03] px-3 py-2.5 text-xs leading-snug text-dark-200">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-warning-500"
        />
        <span>{t('subscription.revoke.acknowledge')}</span>
      </label>

      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={!acknowledged || isPending}
          className="flex-1 rounded-xl bg-warning-500 py-2.5 text-sm font-semibold text-dark-950 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? t('subscription.revoke.processing') : t('subscription.revoke.confirmBtn')}
        </button>
        <button
          onClick={handleClose}
          disabled={isPending}
          className="flex-1 rounded-xl border border-dark-700 py-2.5 text-sm font-medium transition-colors hover:bg-dark-700 disabled:opacity-50"
          style={{ color: textSecondary }}
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
