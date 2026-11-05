import type { Subscription } from '@/types';
import { canOpenTariffSwitch, needsTariff, tariffSelectionPath } from './legacySubscription';

export type CardCtaAction =
  | 'renew'
  | 'chooseTariff'
  | 'moveToTariff'
  | 'getSubscription'
  | 'support';

/** Подпись главной кнопки — одна и та же на странице подписки, главной и плашке. */
export const CARD_CTA_LABEL: Record<CardCtaAction, string> = {
  renew: 'subscription.extend',
  chooseTariff: 'subscription.cardCta.chooseTariff',
  moveToTariff: 'subscription.cta.moveToTariff',
  getSubscription: 'subscription.getSubscription',
  support: 'subscription.noOptionsContactSupport',
};

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
 * - disabled — поддержка: у нас его ставит только админ в панели (суточной нет,
 *   учёт трафика в форке не отключает, а снимает белые списки), бот её не продлит
 *   и тариф не сменит;
 * - суточная (апстрим): истёкшая — новая покупка, работающая — ничего.
 */
export function subscriptionCardCta(
  subscription: CardCtaSubscription | null | undefined,
): CardCta | null {
  if (!subscription) return null;
  if (needsTariff(subscription)) {
    return { action: 'moveToTariff', to: tariffSelectionPath(subscription.id) };
  }
  if (subscription.is_trial) return { action: 'chooseTariff', to: '/subscription/purchase' };

  if (subscription.status === 'disabled') return { action: 'support', to: '/support' };

  const running = subscription.is_active || subscription.is_limited;
  if (subscription.is_daily) {
    return running ? null : { action: 'getSubscription', to: '/subscription/purchase' };
  }
  if (!subscription.tariff_id) return { action: 'getSubscription', to: '/subscription/purchase' };
  return { action: 'renew', to: `/subscriptions/${subscription.id}/renew` };
}

/**
 * «Сменить тариф» под названием тарифа. Бот меняет тариф только у активной
 * подписки (tariff_switch.py), а истёкшей отвечает «купите новый тариф» — для неё
 * это витрина. У limited и disabled бот смену отклоняет, кнопки нет.
 */
export function tariffSwitchLink(
  subscription:
    | (CardCtaSubscription & Partial<Pick<Subscription, 'is_expired'>>)
    | null
    | undefined,
): string | null {
  if (!subscription) return null;
  if (canOpenTariffSwitch(subscription)) return tariffSelectionPath(subscription.id);
  const expired = subscription.status === 'expired' || subscription.is_expired === true;
  if (
    expired &&
    subscription.tariff_id &&
    !subscription.is_trial &&
    !subscription.is_daily &&
    !needsTariff(subscription)
  ) {
    return '/subscription/purchase';
  }
  return null;
}
