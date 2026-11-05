import { describe, expect, it } from 'vitest';
import type { Subscription } from '@/types';
import { pickHelpSituation } from './situation';

const base: Subscription = {
  id: 5,
  status: 'active',
  is_trial: false,
  end_date: '2026-12-01T00:00:00Z',
  days_left: 20,
  hours_left: 0,
  traffic_limit_gb: 10,
  traffic_used_gb: 1,
  traffic_used_percent: 10,
  device_limit: 3,
  is_active: true,
  is_expired: false,
  is_limited: false,
  tariff_id: 1,
} as unknown as Subscription;

const sub = (patch: Partial<Subscription>): Subscription => ({ ...base, ...patch });

describe('pickHelpSituation', () => {
  it('returns nothing without a subscription or when all is fine', () => {
    expect(pickHelpSituation(null, null)).toBeNull();
    expect(pickHelpSituation(base, 1)).toBeNull();
  });

  it('expired beats exhausted traffic', () => {
    const s = sub({ status: 'expired', is_active: false, is_expired: true, is_limited: true });
    expect(pickHelpSituation(s, 1)?.kind).toBe('expired');
  });

  it('is_limited means whitelist traffic is out', () => {
    expect(pickHelpSituation(sub({ is_limited: true, is_active: false }), 1)?.kind).toBe(
      'trafficOut',
    );
  });

  it('used ≥ limit is out even while status stays active (strip-whitelist mode)', () => {
    expect(pickHelpSituation(sub({ traffic_used_gb: 10 }), 1)?.kind).toBe('trafficOut');
  });

  it('used 80 %…<100 % is low, with numbers for the card', () => {
    expect(pickHelpSituation(sub({ traffic_used_gb: 9 }), 1)).toEqual({
      kind: 'trafficLow',
      usedGb: 9,
      limitGb: 10,
    });
    expect(pickHelpSituation(sub({ traffic_used_gb: 7.9 }), 1)).toBeNull();
  });

  it('unlimited traffic never triggers traffic cards', () => {
    expect(pickHelpSituation(sub({ traffic_limit_gb: 0, traffic_used_gb: 500 }), 1)).toBeNull();
  });

  it('all slots taken', () => {
    expect(pickHelpSituation(sub({}), 3)).toEqual({ kind: 'slotsFull', deviceLimit: 3 });
  });

  it('expiring at 3 days, not at 4', () => {
    expect(pickHelpSituation(sub({ days_left: 3 }), 1)).toEqual({ kind: 'expiring', daysLeft: 3 });
    expect(pickHelpSituation(sub({ days_left: 4 }), 1)).toBeNull();
  });

  it('trial shows the trial card instead of expiring', () => {
    expect(pickHelpSituation(sub({ is_trial: true, days_left: 2 }), 1)).toEqual({
      kind: 'trial',
      daysLeft: 2,
    });
  });

  it('no devices connected', () => {
    expect(pickHelpSituation(base, 0)?.kind).toBe('noDevices');
  });

  it('disabled subscriptions get no card', () => {
    expect(pickHelpSituation(sub({ status: 'disabled', is_active: false }), 0)).toBeNull();
  });
});
