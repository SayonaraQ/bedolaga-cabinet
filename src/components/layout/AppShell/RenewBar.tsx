import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import { subscriptionApi } from '@/api/subscription';
import { XIcon } from '@/components/icons';
import { useHaptic } from '@/platform';
import { safeLocal } from '@/utils/safeStorage';
import { uiLocale } from '@/utils/uiLocale';
import {
  RENEW_BAR_DISMISS_KEY,
  localDay,
  renewBarState,
  type RenewBarSubscription,
} from '@/utils/renewBar';

interface RenewBarProps {
  subscription: RenewBarSubscription | null | undefined;
  /** Для тестов; по умолчанию — сегодняшняя локальная дата. */
  today?: string;
}

/**
 * «Осталось N дней · Продлить» над нижним меню, когда до конца 3 дня и меньше.
 * Крестик прячет панель до завтра (локальная дата в safeLocal — при
 * заблокированном хранилище панель просто вернётся при следующем заходе).
 */
export function RenewBar({ subscription, today = localDay() }: RenewBarProps) {
  const { t } = useTranslation();
  const haptic = useHaptic();
  const [dismissedOn, setDismissedOn] = useState<string | null>(() =>
    safeLocal.getItem(RENEW_BAR_DISMISS_KEY),
  );

  const state = renewBarState(subscription, { today, dismissedOn });
  const visible = state !== null;

  // Низ страницы и прижатые к низу элементы поднимаются над панелью
  // (globals.css, [data-renew-bar="on"]).
  useEffect(() => {
    if (!visible) return;
    document.documentElement.dataset.renewBar = 'on';
    return () => {
      delete document.documentElement.dataset.renewBar;
    };
  }, [visible]);

  if (!state) return null;

  const until = new Date(state.endDate).toLocaleDateString(uiLocale(), {
    day: 'numeric',
    month: 'long',
  });

  const dismiss = () => {
    haptic.impact('light');
    safeLocal.setItem(RENEW_BAR_DISMISS_KEY, today);
    setDismissedOn(today);
  };

  return (
    <div
      role="region"
      aria-label={t('renewBar.label')}
      className="fixed z-40 flex items-center gap-2 rounded-2xl border border-warning-500/45 bg-dark-900/95 py-2 pl-4 pr-2 shadow-lg backdrop-blur-linear lg:hidden"
      style={{
        left: 'max(16px, env(safe-area-inset-left, 0px))',
        right: 'max(16px, env(safe-area-inset-right, 0px))',
        bottom: 'calc(var(--mobile-nav-offset) + var(--mobile-nav-height) + 8px)',
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-warning-400">
          {state.daysLeft === 0
            ? t('renewBar.lastDay')
            : t('renewBar.daysLeft', { count: state.daysLeft })}
        </div>
        <div className="truncate text-xs text-dark-400">{t('renewBar.until', { date: until })}</div>
      </div>
      <Link
        to={state.target}
        className="cta-pulse shrink-0 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-bold text-on-accent transition-colors hover:bg-accent-600"
      >
        {state.isTrial ? t('renewBar.subscribe') : t('renewBar.renew')}
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('renewBar.hideUntilTomorrow')}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-dark-400 transition-colors hover:text-dark-100"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Панель на экранах с нижним меню. Подписка — тот же запрос и ключ, что на
 * главной (['subscription']), так что отдельного похода в сеть не появляется.
 */
export function RenewBarHost() {
  const { data } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => subscriptionApi.getSubscription(),
    retry: false,
    staleTime: 60_000,
  });
  return <RenewBar subscription={data?.subscription ?? null} />;
}
