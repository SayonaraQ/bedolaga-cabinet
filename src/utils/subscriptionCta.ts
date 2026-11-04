import type { Subscription } from '@/types';
import { needsTariff, tariffSelectionPath } from './legacySubscription';

export type CardCtaAction = 'renew' | 'chooseTariff' | 'moveToTariff' | 'getSubscription';

export interface CardCta {
  action: CardCtaAction;
  to: string;
}

type CardCtaSubscription = Pick<
  Subscription,
  'id' | 'status' | 'is_active' | 'is_limited' | 'is_trial' | 'is_daily' | 'tariff_id'
> &
  Partial<Pick<Subscription, 'requires_tariff_selection'>>;

/**
 * Главная кнопка страницы подписки — в карточке срока («Осталось» / «Истекла»),
 * во всех состояниях одинаково (решение владельца 05.11.2026). Раньше у всего,
 * кроме активной подписки, она жила общим блоком внизу страницы.
 *
 * Куда ведёт:
 * - тарифная активная, истёкшая или с кончившимся трафиком — продление этой же
 *   подписки (бот продлевает всё, кроме disabled и pending: renewal.py);
 * - триал — витрина тарифов; старая без тарифа — выбор тарифа для неё;
 * - disabled и истёкшая суточная — новая покупка;
 * - работающая суточная — ничего: она списывается сама.
 */
export function subscriptionCardCta(
  subscription: CardCtaSubscription | null | undefined,
): CardCta | null {
  if (!subscription) return null;
  if (needsTariff(subscription)) {
    return { action: 'moveToTariff', to: tariffSelectionPath(subscription.id) };
  }
  if (subscription.is_trial) return { action: 'chooseTariff', to: '/subscription/purchase' };

  const running = subscription.is_active || subscription.is_limited;
  if (subscription.is_daily) {
    return running ? null : { action: 'getSubscription', to: '/subscription/purchase' };
  }
  if (subscription.status === 'disabled' || !subscription.tariff_id) {
    return { action: 'getSubscription', to: '/subscription/purchase' };
  }
  return { action: 'renew', to: `/subscriptions/${subscription.id}/renew` };
}
