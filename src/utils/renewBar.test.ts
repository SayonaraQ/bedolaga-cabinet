import { describe, expect, it } from 'vitest';
import { renewBarState } from './renewBar';

// Закреплённая панель «Продлить» над нижним меню: за 3 дня до конца и меньше,
// на всех экранах с меню, со «скрыть до завтра». Решение владельца 05.11.2026.

const sub = (overrides: Record<string, unknown> = {}) => ({
  id: 42,
  is_active: true,
  is_limited: false,
  is_trial: false,
  is_daily: false,
  days_left: 3,
  end_date: '2026-11-08T12:00:00Z',
  tariff_id: 7,
  requires_tariff_selection: false,
  ...overrides,
});

const TODAY = '2026-11-05';

describe('renewBarState', () => {
  it('shows three days before the end and leads to renewal', () => {
    expect(renewBarState(sub(), { today: TODAY, dismissedOn: null })).toEqual({
      daysLeft: 3,
      endDate: '2026-11-08T12:00:00Z',
      target: '/subscriptions/42/renew',
      isTrial: false,
    });
  });

  it.each([0, 1, 2])('shows with %i days left', (days) => {
    expect(
      renewBarState(sub({ days_left: days }), { today: TODAY, dismissedOn: null }),
    ).not.toBeNull();
  });

  it('stays hidden with four days left', () => {
    expect(renewBarState(sub({ days_left: 4 }), { today: TODAY, dismissedOn: null })).toBeNull();
  });

  it('hides for the rest of the day after the cross and returns tomorrow', () => {
    expect(renewBarState(sub(), { today: TODAY, dismissedOn: TODAY })).toBeNull();
    expect(renewBarState(sub(), { today: '2026-11-06', dismissedOn: TODAY })).not.toBeNull();
  });

  it('sends a trial to the plans, not to renewal', () => {
    expect(
      renewBarState(sub({ is_trial: true, tariff_id: null }), { today: TODAY, dismissedOn: null }),
    ).toMatchObject({ target: '/subscription/purchase', isTrial: true });
  });

  it('sends a legacy subscription without a tariff to the plan picker', () => {
    expect(
      renewBarState(sub({ tariff_id: null, requires_tariff_selection: true }), {
        today: TODAY,
        dismissedOn: null,
      }),
    ).toMatchObject({ target: '/subscription/purchase?subscriptionId=42' });
  });

  it('keeps showing while traffic is exhausted but time is running out', () => {
    expect(
      renewBarState(sub({ is_active: false, is_limited: true }), {
        today: TODAY,
        dismissedOn: null,
      }),
    ).not.toBeNull();
  });

  it.each([
    ['no subscription', null],
    ['an expired one: the page already says so', sub({ is_active: false, days_left: 0 })],
    ['a daily one: it renews itself', sub({ is_daily: true, days_left: 0 })],
  ])('stays hidden for %s', (_label, subscription) => {
    expect(renewBarState(subscription, { today: TODAY, dismissedOn: null })).toBeNull();
  });
});
