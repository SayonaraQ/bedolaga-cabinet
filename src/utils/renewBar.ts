import type { Subscription } from '../types';
import { subscriptionCardCta, type CardCtaAction } from './subscriptionCta';

/**
 * Закреплённая панель «Продлить» над нижним меню (решение владельца 05.11.2026).
 *
 * Показывается, когда до конца подписки 3 дня и меньше, на всех экранах с
 * нижним меню; крестик прячет её до конца дня. Истёкшей подписке панель не
 * нужна — о ней и так кричит карточка, суточная продлевается сама.
 */
export const RENEW_BAR_DAYS = 3;
export const RENEW_BAR_DISMISS_KEY = 'renew-bar-dismissed-on';

export type RenewBarSubscription = Pick<
  Subscription,
  | 'id'
  | 'status'
  | 'is_active'
  | 'is_limited'
  | 'is_trial'
  | 'is_daily'
  | 'days_left'
  | 'end_date'
  | 'tariff_id'
  | 'requires_tariff_selection'
>;

export interface RenewBarState {
  daysLeft: number;
  endDate: string;
  /** Куда ведёт кнопка — та же главная кнопка, что в карточке срока на странице подписки. */
  target: string;
  action: CardCtaAction;
}

/** Локальная дата YYYY-MM-DD: «до завтра» — по часам человека, а не по UTC. */
export function localDay(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function renewBarState(
  subscription: RenewBarSubscription | null | undefined,
  { today, dismissedOn }: { today: string; dismissedOn: string | null },
): RenewBarState | null {
  if (!subscription) return null;
  if (!subscription.is_active && !subscription.is_limited) return null;
  if (subscription.is_daily) return null;
  if (subscription.days_left > RENEW_BAR_DAYS) return null;
  if (dismissedOn === today) return null;

  const cta = subscriptionCardCta(subscription);
  if (!cta) return null;

  return {
    daysLeft: Math.max(0, subscription.days_left),
    endDate: subscription.end_date,
    target: cta.to,
    action: cta.action,
  };
}
