import type { Subscription } from '@/types';

export type HelpSituationKind =
  | 'expired'
  | 'trafficOut'
  | 'trafficLow'
  | 'slotsFull'
  | 'expiring'
  | 'noDevices'
  | 'trial';

export interface HelpSituation {
  kind: HelpSituationKind;
  daysLeft?: number;
  usedGb?: number;
  limitGb?: number;
  deviceLimit?: number;
}

/** Ответы FAQ к каждой карточке (боевые id, см. HELP_POPULAR_FAQ_IDS). */
export const HELP_SITUATION_FAQ: Record<HelpSituationKind, { primary?: number; links: number[] }> =
  {
    expired: { links: [56, 57] },
    trafficOut: { links: [49, 53] },
    trafficLow: { primary: 53, links: [49] },
    slotsFull: { links: [7, 47] },
    expiring: { links: [55] },
    noDevices: { links: [2, 3] },
    trial: { links: [24] },
  };

/** «На исходе» — израсходовано 80 % лимита «Белых списков» и больше. */
export const TRAFFIC_LOW_SHARE = 0.8;
export const EXPIRING_DAYS = 3;

type SituationSubscription = Pick<
  Subscription,
  | 'status'
  | 'is_trial'
  | 'is_active'
  | 'is_expired'
  | 'is_limited'
  | 'days_left'
  | 'traffic_limit_gb'
  | 'traffic_used_gb'
  | 'device_limit'
>;

/**
 * Одна карточка ситуации, по приоритету (решение владельца 05.11.2026):
 * истекла → трафик кончился → на исходе → слоты заняты → ≤ 3 дней →
 * нет устройств → пробный период. Отключённая админом подписка карточки не
 * получает: её ведёт поддержка.
 *
 * Трафик считается только на «Белых списках». В режиме «снять белые списки»
 * подписка остаётся active, поэтому «кончился» — это и `is_limited`, и
 * израсходованный лимит.
 */
export function pickHelpSituation(
  sub: SituationSubscription | null | undefined,
  devicesTotal: number | null | undefined,
): HelpSituation | null {
  if (!sub || sub.status === 'disabled') return null;

  if (sub.is_expired || sub.status === 'expired') return { kind: 'expired' };

  const limit = sub.traffic_limit_gb ?? 0;
  const used = sub.traffic_used_gb ?? 0;
  if (sub.is_limited || (limit > 0 && used >= limit)) return { kind: 'trafficOut' };
  if (limit > 0 && used >= limit * TRAFFIC_LOW_SHARE) {
    return { kind: 'trafficLow', usedGb: used, limitGb: limit };
  }

  if (!sub.is_active) return null;

  const devices = devicesTotal ?? null;
  if (devices !== null && sub.device_limit > 0 && devices >= sub.device_limit) {
    return { kind: 'slotsFull', deviceLimit: sub.device_limit };
  }
  if (!sub.is_trial && sub.days_left <= EXPIRING_DAYS) {
    return { kind: 'expiring', daysLeft: sub.days_left };
  }
  if (devices === 0) return { kind: 'noDevices' };
  if (sub.is_trial) return { kind: 'trial', daysLeft: sub.days_left };
  return null;
}
