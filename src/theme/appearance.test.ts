import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ENABLED_THEMES, DEFAULT_THEME_COLORS } from '@/types/theme';
import {
  APPEARANCE_TOKENS,
  buildSeasonalColors,
  resolveAppearance,
  SEASONAL_PALETTES,
  seasonFor,
} from './appearance';

afterEach(() => vi.unstubAllEnvs());

describe('seasonFor: Moscow calendar independently of device timezone', () => {
  it.each([
    ['2025-02-28', 'winter'],
    ['2025-03-01', 'spring'],
    ['2024-02-28', 'winter'],
    ['2024-02-29', 'winter'],
    ['2024-03-01', 'spring'],
    ['2026-05-31', 'spring'],
    ['2026-06-01', 'summer'],
    ['2026-08-31', 'summer'],
    ['2026-09-01', 'autumn'],
    ['2026-11-30', 'autumn'],
    ['2026-12-01', 'winter'],
    ['2026-12-31', 'winter'],
    ['2027-01-01', 'winter'],
  ])('%s is %s', (day, season) => {
    expect(seasonFor(new Date(`${day}T12:00:00Z`))).toBe(season);
  });

  it('Nov 30 21:30 UTC is already December in Moscow, even in America/Los_Angeles', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles');
    expect(seasonFor(new Date('2026-11-30T20:59:59Z'))).toBe('autumn');
    expect(seasonFor(new Date('2026-11-30T21:30:00Z'))).toBe('winter');
  });
});

describe('resolveAppearance', () => {
  const now = new Date('2026-12-01T00:00:00Z');
  it.each(['dark', 'light'] as const)(
    'availability off uses %s even with an on preference',
    (base) => {
      expect(resolveAppearance({ base, flags: DEFAULT_ENABLED_THEMES, pref: 'on', now })).toEqual({
        id: base,
        base,
        season: null,
        seasonalActive: false,
      });
    },
  );
  it.each([true, false])('absent preference follows admin default %s', (seasonalDefault) => {
    const result = resolveAppearance({
      base: 'dark',
      flags: { seasonal: true, seasonalDefault },
      now,
    });
    expect(result.seasonalActive).toBe(seasonalDefault);
  });
  it('explicit off wins over default true', () => {
    expect(
      resolveAppearance({
        base: 'dark',
        flags: { seasonal: true, seasonalDefault: true },
        pref: 'off',
        now,
      }).id,
    ).toBe('dark');
  });
  it.each([
    ['dark', 'winter-night'],
    ['light', 'winter-day'],
  ] as const)('%s resolves to %s', (base, id) => {
    expect(
      resolveAppearance({
        base,
        flags: { seasonal: true, seasonalDefault: false },
        pref: 'on',
        now,
      }),
    ).toEqual({ id, base, season: 'winter', seasonalActive: true });
  });
});

describe('seasonal palettes', () => {
  it('winter-night uses the approved colours and retains admin status roles', () => {
    const admin = {
      ...DEFAULT_THEME_COLORS,
      success: '#123456',
      error: '#654321',
      warning: '#abcdef',
    };
    expect(buildSeasonalColors('winter-night', admin)).toEqual({
      accent: '#22D3EE',
      darkBackground: '#020914',
      darkSurface: '#0A1D30',
      darkText: '#EFFAFF',
      darkTextSecondary: '#A1BCCA',
      lightBackground: '#E7F0F7',
      lightSurface: '#F7FBFE',
      lightText: '#173249',
      lightTextSecondary: '#516F84',
      success: admin.success,
      warning: admin.warning,
      error: admin.error,
    });
  });
  it('only autumn-night overrides warning', () => {
    for (const id of Object.keys(SEASONAL_PALETTES) as (keyof typeof SEASONAL_PALETTES)[]) {
      expect(buildSeasonalColors(id, DEFAULT_THEME_COLORS).warning).toBe(
        id === 'autumn-night' ? '#F4E870' : DEFAULT_THEME_COLORS.warning,
      );
    }
  });
  it.each(['winter', 'spring', 'summer', 'autumn'] as const)(
    '%s-day puts the day row into light fields',
    (season) => {
      const id = `${season}-day` as const;
      const day = SEASONAL_PALETTES[id];
      expect(buildSeasonalColors(id, DEFAULT_THEME_COLORS)).toMatchObject({
        accent: day.accent,
        lightBackground: day.bg,
        lightSurface: day.surface,
        lightText: day.text,
        lightTextSecondary: day.textSecondary,
        darkBackground: SEASONAL_PALETTES[`${season}-night`].bg,
      });
    },
  );
  it('provides contour tokens for all ten appearances and autumn semantic overrides', () => {
    expect(Object.keys(APPEARANCE_TOKENS)).toHaveLength(10);
    expect(APPEARANCE_TOKENS['autumn-night']).toMatchObject({
      '--color-info': '115, 209, 255',
      '--color-urgent-400': '255, 118, 174',
      '--nc-glint': '#FFE2A8',
    });
    expect(APPEARANCE_TOKENS.light['--color-urgent-400']).toBeUndefined();
  });
});
