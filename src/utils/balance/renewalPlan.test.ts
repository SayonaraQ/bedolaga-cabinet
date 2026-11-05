import { describe, expect, it } from 'vitest';
import type { PaymentMethod, RenewalOption, Subscription } from '../../types';
import { buildQuickTopUps, buildRenewalPlan, pickAutopayOption } from './renewalPlan';

function option(periodDays: number, priceKopeks: number): RenewalOption {
  return {
    period_days: periodDays,
    price_kopeks: priceKopeks,
    price_rubles: priceKopeks / 100,
    discount_percent: 0,
    original_price_kopeks: null,
  };
}

const options = [option(30, 30000), option(60, 58000), option(90, 85000)];
const now = new Date('2026-11-05T12:00:00Z');
const method: Pick<PaymentMethod, 'min_amount_kopeks' | 'max_amount_kopeks' | 'quick_amounts'> = {
  min_amount_kopeks: 1000,
  max_amount_kopeks: 1000000,
};

function subscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 42,
    status: 'active',
    is_trial: false,
    is_daily: false,
    start_date: '2026-10-29T00:00:00Z',
    end_date: '2026-11-28T00:00:00Z',
    days_left: 22,
    hours_left: 12,
    minutes_left: 0,
    time_left_display: '22 дня',
    traffic_limit_gb: 100,
    traffic_used_gb: 0,
    traffic_used_percent: 0,
    device_limit: 3,
    connected_squads: [],
    servers: [],
    autopay_enabled: true,
    autopay_days_before: 3,
    subscription_url: null,
    hide_subscription_link: false,
    is_active: true,
    is_expired: false,
    is_limited: false,
    tariff_name: 'Уверенный стандарт',
    ...overrides,
  };
}

function plan(balanceKopeks: number, overrides: Partial<Subscription> = {}) {
  return buildRenewalPlan({ subscription: subscription(overrides), options, balanceKopeks, now });
}

describe('pickAutopayOption', () => {
  it.each([undefined, null, 45])('выбирает минимальный период при настройке %s', (periodDays) => {
    expect(pickAutopayOption(options, periodDays)).toBe(options[0]);
  });

  it('выбирает настроенный период из опций', () => {
    expect(pickAutopayOption(options, 60)).toBe(options[1]);
  });

  it('находит минимальный период независимо от порядка, не меняя опции', () => {
    const unsorted = [options[2], options[0], options[1]];

    expect(pickAutopayOption(unsorted)).toBe(options[0]);
    expect(unsorted).toEqual([options[2], options[0], options[1]]);
  });

  it('возвращает null для пустых опций', () => {
    expect(pickAutopayOption([])).toBeNull();
  });

  it.each([0, -100])('возвращает null при выбранной цене %i', (priceKopeks) => {
    expect(pickAutopayOption([option(30, priceKopeks), options[1]])).toBeNull();
    expect(pickAutopayOption([options[0], option(60, priceKopeks)], 60)).toBeNull();
  });

  it('не отбрасывает выбранный период из-за нулевой цены другой опции', () => {
    expect(pickAutopayOption([option(30, 0), options[1]], 60)).toBe(options[1]);
  });
});

describe('buildRenewalPlan', () => {
  it('считает доступные продления и дату списания при достаточном балансе', () => {
    expect(plan(102904)).toEqual({
      kind: 'enough',
      tariffName: 'Уверенный стандарт',
      extraDevices: 0,
      periodDays: 30,
      priceKopeks: 30000,
      renewalsCovered: 3,
      shortfallKopeks: 0,
      autopayEnabled: true,
      endDate: new Date('2026-11-28T00:00:00Z'),
      chargeDate: new Date('2026-11-25T00:00:00Z'),
      chargeDatePassed: false,
      subscriptionId: 42,
    });
  });

  it('берёт дополнительные устройства и полную цену из выбранной опции', () => {
    expect(
      buildRenewalPlan({
        subscription: subscription(),
        options: [
          { ...option(30, 45000), extra_devices: 1 },
          { ...option(60, 88000), extra_devices: 2 },
        ],
        balanceKopeks: 102904,
        now,
      }),
    ).toMatchObject({ extraDevices: 1, priceKopeks: 45000 });
  });

  it('считает дополнительные устройства отсутствующими у старого бота', () => {
    expect(plan(102904)).toMatchObject({ extraDevices: 0 });
  });

  it.each([-1, 1.5])('сбрасывает недопустимое число дополнительных устройств %s', (count) => {
    expect(
      buildRenewalPlan({
        subscription: subscription(),
        options: [{ ...option(30, 45000), extra_devices: count }],
        balanceKopeks: 102904,
        now,
      }),
    ).toMatchObject({ extraDevices: 0, priceKopeks: 45000 });
  });

  it('округляет нехватку 179,50 рубля вверх до 180 рублей', () => {
    expect(plan(12050)).toMatchObject({
      kind: 'short',
      renewalsCovered: 0,
      shortfallKopeks: 18000,
    });
  });

  it('при балансе ровно в цену продления считает средства достаточными', () => {
    expect(plan(30000)).toMatchObject({
      kind: 'enough',
      renewalsCovered: 1,
      shortfallKopeks: 0,
    });
  });

  it('сохраняет нехватку в целых рублях без дополнительного округления', () => {
    expect(plan(29500)).toMatchObject({ kind: 'short', shortfallKopeks: 500 });
  });

  it('использует цену и период выбранного автопродления', () => {
    expect(plan(102904, { autopay_period_days: 60 })).toMatchObject({
      periodDays: 60,
      priceKopeks: 58000,
      renewalsCovered: 1,
    });
  });

  it.each([
    ['2026-11-24T23:59:59.999Z', false],
    ['2026-11-25T00:00:00Z', true],
    ['2026-11-26T00:00:00Z', true],
  ])('сравнивает дату списания с %s включительно', (currentTime, chargeDatePassed) => {
    expect(
      buildRenewalPlan({
        subscription: subscription(),
        options,
        balanceKopeks: 102904,
        now: new Date(currentTime),
      }),
    ).toMatchObject({ chargeDatePassed });
  });

  it.each([{ is_expired: true }, { status: 'expired' }])(
    'отдаёт приоритет истечению подписки %j при любом балансе',
    (overrides) => {
      expect(plan(102904, overrides)).toMatchObject({ kind: 'expired', shortfallKopeks: 0 });
      expect(plan(12050, overrides)).toMatchObject({ kind: 'expired', shortfallKopeks: 18000 });
    },
  );

  it('сохраняет выключенное автопродление и отсутствие названия тарифа', () => {
    expect(plan(102904, { tariff_name: undefined, autopay_enabled: false })).toMatchObject({
      kind: 'enough',
      tariffName: null,
      autopayEnabled: false,
    });
  });

  it.each([null, subscription({ is_trial: true }), subscription({ is_daily: true })])(
    'скрывает план без подходящей подписки %j',
    (currentSubscription) => {
      expect(
        buildRenewalPlan({
          subscription: currentSubscription,
          options,
          balanceKopeks: 102904,
          now,
        }),
      ).toBeNull();
    },
  );

  it.each([undefined, [], [option(30, 0)]])(
    'скрывает план без положительной цены продления %j',
    (currentOptions) => {
      expect(
        buildRenewalPlan({
          subscription: subscription(),
          options: currentOptions,
          balanceKopeks: 102904,
          now,
        }),
      ).toBeNull();
    },
  );
});

describe('buildQuickTopUps', () => {
  it('предлагает три продления по выбранной цене при достаточном балансе', () => {
    expect(buildQuickTopUps(plan(102904), method)).toEqual({
      items: [
        { amountKopeks: 30000, labelKey: 'months', count: 1 },
        { amountKopeks: 60000, labelKey: 'months', count: 2 },
        { amountKopeks: 90000, labelKey: 'months', count: 3 },
      ],
      defaultIndex: 1,
    });
  });

  it('предлагает округлённую нехватку и ещё одно или два продления', () => {
    expect(buildQuickTopUps(plan(12050), method)).toEqual({
      items: [
        { amountKopeks: 18000, labelKey: 'shortfall', count: 0 },
        { amountKopeks: 48000, labelKey: 'months', count: 1 },
        { amountKopeks: 78000, labelKey: 'months', count: 2 },
      ],
      defaultIndex: 0,
    });
  });

  it.each([12050, 30000, 102904])(
    'для истёкшей подписки при балансе %i суммы зависят от нехватки',
    (balanceKopeks) => {
      expect(buildQuickTopUps(plan(balanceKopeks, { is_expired: true }), method)).toEqual(
        buildQuickTopUps(plan(balanceKopeks), method),
      );
    },
  );

  it('использует месяцы для выбранного периода, кратного 30 дням', () => {
    expect(buildQuickTopUps(plan(102904, { autopay_period_days: 60 }), method)).toEqual({
      items: [
        { amountKopeks: 58000, labelKey: 'months', count: 2 },
        { amountKopeks: 116000, labelKey: 'months', count: 4 },
        { amountKopeks: 174000, labelKey: 'months', count: 6 },
      ],
      defaultIndex: 1,
    });
  });

  it('использует дни для семидневного периода с нехваткой', () => {
    const weeklyPlan = buildRenewalPlan({
      subscription: subscription(),
      options: [option(7, 9000)],
      balanceKopeks: 0,
      now,
    });

    expect(buildQuickTopUps(weeklyPlan, method)).toEqual({
      items: [
        { amountKopeks: 9000, labelKey: 'shortfall', count: 0 },
        { amountKopeks: 18000, labelKey: 'days', count: 7 },
        { amountKopeks: 27000, labelKey: 'days', count: 14 },
      ],
      defaultIndex: 0,
    });
  });

  it('выбирает первый оставшийся элемент, если нехватка меньше минимума', () => {
    expect(buildQuickTopUps(plan(29500), method)).toEqual({
      items: [
        { amountKopeks: 30500, labelKey: 'months', count: 1 },
        { amountKopeks: 60500, labelKey: 'months', count: 2 },
      ],
      defaultIndex: 0,
    });
  });

  it('сохраняет выбор второй суммы после удаления первой и включает границы', () => {
    expect(
      buildQuickTopUps(plan(102904), {
        min_amount_kopeks: 60000,
        max_amount_kopeks: 90000,
      }),
    ).toEqual({
      items: [
        { amountKopeks: 60000, labelKey: 'months', count: 2 },
        { amountKopeks: 90000, labelKey: 'months', count: 3 },
      ],
      defaultIndex: 0,
    });
  });

  it('без плана предлагает стандартные суммы', () => {
    expect(buildQuickTopUps(null, method)).toEqual({
      items: [
        { amountKopeks: 10000, labelKey: 'plain', count: 0 },
        { amountKopeks: 30000, labelKey: 'plain', count: 0 },
        { amountKopeks: 50000, labelKey: 'plain', count: 0 },
        { amountKopeks: 100000, labelKey: 'plain', count: 0 },
      ],
      defaultIndex: 1,
    });
  });

  it('использует суммы способа и сбрасывает выбор, если выбранная сумма выше максимума', () => {
    expect(
      buildQuickTopUps(null, {
        ...method,
        quick_amounts: [5000, 200000],
        max_amount_kopeks: 100000,
      }),
    ).toEqual({
      items: [{ amountKopeks: 5000, labelKey: 'plain', count: 0 }],
      defaultIndex: 0,
    });
  });

  it('сохраняет выбор исходного элемента среди одинаковых сумм', () => {
    expect(buildQuickTopUps(null, { ...method, quick_amounts: [5000, 5000, 2000000] })).toEqual({
      items: [
        { amountKopeks: 5000, labelKey: 'plain', count: 0 },
        { amountKopeks: 5000, labelKey: 'plain', count: 0 },
      ],
      defaultIndex: 1,
    });
  });

  it('возвращает индекс -1, когда все суммы исключены', () => {
    expect(buildQuickTopUps(plan(102904), { ...method, max_amount_kopeks: 20000 })).toEqual({
      items: [],
      defaultIndex: -1,
    });
  });

  it('сохраняет явно пустые быстрые суммы способа', () => {
    expect(buildQuickTopUps(null, { ...method, quick_amounts: [] })).toEqual({
      items: [],
      defaultIndex: -1,
    });
  });
});
