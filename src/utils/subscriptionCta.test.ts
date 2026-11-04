import { describe, expect, it } from 'vitest';
import { subscriptionCardCta, tariffSwitchLink } from './subscriptionCta';

// Главная кнопка страницы подписки стоит в карточке срока («Осталось» /
// «Истекла») во всех состояниях, а не общим блоком внизу. Решение владельца
// 05.11.2026: «продление должно быть на видном месте там же, где написано,
// что подписка истекла».

const sub = (overrides: Record<string, unknown> = {}) => ({
  id: 42,
  status: 'active',
  is_active: true,
  is_limited: false,
  is_expired: false,
  is_trial: false,
  is_daily: false,
  tariff_id: 7,
  requires_tariff_selection: false,
  ...overrides,
});

describe('subscriptionCardCta', () => {
  it('renews an active tariff subscription', () => {
    expect(subscriptionCardCta(sub())).toEqual({
      action: 'renew',
      to: '/subscriptions/42/renew',
    });
  });

  it('renews an expired tariff subscription on the same page — the bot accepts it', () => {
    expect(
      subscriptionCardCta(sub({ status: 'expired', is_active: false, is_expired: true })),
    ).toEqual({ action: 'renew', to: '/subscriptions/42/renew' });
  });

  it('renews a subscription whose traffic ran out', () => {
    expect(
      subscriptionCardCta(sub({ status: 'limited', is_active: false, is_limited: true })),
    ).toEqual({ action: 'renew', to: '/subscriptions/42/renew' });
  });

  it('sends a trial to the plans', () => {
    expect(subscriptionCardCta(sub({ status: 'trial', is_trial: true, tariff_id: null }))).toEqual({
      action: 'chooseTariff',
      to: '/subscription/purchase',
    });
  });

  it('moves a legacy subscription without a tariff to the plan picker', () => {
    expect(subscriptionCardCta(sub({ tariff_id: null, requires_tariff_selection: true }))).toEqual({
      action: 'moveToTariff',
      to: '/subscription/purchase?subscriptionId=42',
    });
  });

  // disabled у нас ставит только админ в панели: суточной нет, а учёт трафика в
  // форке не отключает, а снимает белые списки (limited). Продлить её бот не даст.
  it('sends a subscription disabled by an admin to support', () => {
    expect(subscriptionCardCta(sub({ status: 'disabled', is_active: false }))).toEqual({
      action: 'support',
      to: '/support',
    });
  });

  it('shows nothing for a running daily subscription: it charges itself', () => {
    expect(subscriptionCardCta(sub({ is_daily: true }))).toBeNull();
  });

  it('offers a new purchase once a daily subscription has expired', () => {
    expect(
      subscriptionCardCta(
        sub({ is_daily: true, status: 'expired', is_active: false, is_expired: true }),
      ),
    ).toEqual({ action: 'getSubscription', to: '/subscription/purchase' });
  });
});

// «Сменить тариф» под названием тарифа. Бот меняет тариф только у активной
// подписки; истёкшей он велит купить новый тариф — это витрина.
describe('tariffSwitchLink', () => {
  it('opens the switch for an active tariff subscription', () => {
    expect(tariffSwitchLink(sub())).toBe('/subscription/purchase?subscriptionId=42');
  });

  it('opens the plan showcase for an expired one', () => {
    expect(tariffSwitchLink(sub({ status: 'expired', is_active: false, is_expired: true }))).toBe(
      '/subscription/purchase',
    );
  });

  it.each([
    [
      'traffic ran out: the bot refuses to switch',
      { status: 'limited', is_active: false, is_limited: true },
    ],
    ['disabled', { status: 'disabled', is_active: false }],
    ['trial', { status: 'trial', is_trial: true, tariff_id: null }],
    ['legacy', { tariff_id: null, requires_tariff_selection: true }],
    [
      'expired daily: its card already leads to the showcase',
      { is_daily: true, status: 'expired', is_active: false, is_expired: true },
    ],
  ])('offers nothing for %s', (_name, over) => {
    expect(tariffSwitchLink(sub(over))).toBeNull();
  });
});
