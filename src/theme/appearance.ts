import type { EnabledThemes, ThemeColors } from '@/types/theme';

export type BaseTheme = 'dark' | 'light';
export type Season = 'winter' | 'spring' | 'summer' | 'autumn';
export type SeasonalAppearanceId = `${Season}-${'night' | 'day'}`;
export type AppearanceId = BaseTheme | SeasonalAppearanceId;
export type SeasonalPreference = 'on' | 'off' | null;

const moscowMonth = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Moscow',
  month: 'numeric',
});

export function seasonFor(date: Date): Season {
  const month = Number(moscowMonth.format(date));
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

export function resolveAppearance({
  base,
  flags,
  pref,
  now,
}: {
  base: BaseTheme;
  flags: Pick<EnabledThemes, 'seasonal' | 'seasonalDefault'>;
  pref?: SeasonalPreference;
  now: Date;
}): { id: AppearanceId; base: BaseTheme; season: Season | null; seasonalActive: boolean } {
  const seasonalActive =
    flags.seasonal && (pref ?? (flags.seasonalDefault ? 'on' : 'off')) === 'on';
  const season = seasonalActive ? seasonFor(now) : null;
  return {
    id: season ? `${season}-${base === 'dark' ? 'night' : 'day'}` : base,
    base,
    season,
    seasonalActive,
  };
}

interface AppearancePalette {
  bg: string;
  surface: string;
  accent: string;
  decor: string;
  text: string;
  textSecondary: string;
}

export const SEASONAL_PALETTES: Record<SeasonalAppearanceId, AppearancePalette> = {
  'winter-night': {
    bg: '#020914',
    surface: '#0A1D30',
    accent: '#22D3EE',
    decor: '#B85AFF',
    text: '#EFFAFF',
    textSecondary: '#A1BCCA',
  },
  'winter-day': {
    bg: '#E7F0F7',
    surface: '#F7FBFE',
    accent: '#087F9C',
    decor: '#6F9FC2',
    text: '#173249',
    textSecondary: '#516F84',
  },
  'spring-night': {
    bg: '#071B1A',
    surface: '#153A32',
    accent: '#FF9B9F',
    decor: '#A0D6B7',
    text: '#F2FAF3',
    textSecondary: '#B1CABE',
  },
  'spring-day': {
    bg: '#F7F3E9',
    surface: '#FFFDF5',
    accent: '#AD415C',
    decor: '#719D7A',
    text: '#294235',
    textSecondary: '#627969',
  },
  'summer-night': {
    bg: '#061522',
    surface: '#102B3C',
    accent: '#37BAFF',
    decor: '#FFD36A',
    text: '#F0FAFF',
    textSecondary: '#A3BDCC',
  },
  'summer-day': {
    bg: '#EEF8F7',
    surface: '#FFFDF6',
    accent: '#087E99',
    decor: '#BE9671',
    text: '#153D49',
    textSecondary: '#59777F',
  },
  'autumn-night': {
    bg: '#130A05',
    surface: '#2A170D',
    accent: '#FF9426',
    decor: '#FFD078',
    text: '#FFF4E7',
    textSecondary: '#C8AD96',
  },
  'autumn-day': {
    bg: '#F8F0E6',
    surface: '#FFFBF5',
    accent: '#B4530F',
    decor: '#E0A458',
    text: '#3A2416',
    textSecondary: '#7A5A44',
  },
};

export function isSeasonalAppearance(id: string): id is SeasonalAppearanceId {
  return Object.keys(SEASONAL_PALETTES).includes(id);
}

export function buildSeasonalColors(id: SeasonalAppearanceId, admin: ThemeColors): ThemeColors {
  const season = id.split('-')[0] as Season;
  const night = SEASONAL_PALETTES[`${season}-night`];
  const day = SEASONAL_PALETTES[`${season}-day`];
  return {
    accent: SEASONAL_PALETTES[id].accent,
    darkBackground: night.bg,
    darkSurface: night.surface,
    darkText: night.text,
    darkTextSecondary: night.textSecondary,
    lightBackground: day.bg,
    lightSurface: day.surface,
    lightText: day.text,
    lightTextSecondary: day.textSecondary,
    success: admin.success,
    warning: id === 'autumn-night' ? '#F4E870' : admin.warning,
    error: admin.error,
  };
}

const NIGHT_INFO = '125, 211, 252';
const DAY_INFO = '2, 132, 199';
type ExtraTokens = Record<'--color-info' | '--nc-glint' | '--nc-cta-a' | '--nc-cta-b', string> & {
  '--color-urgent-400'?: string;
};

function tokens(info: string, glint: string, ctaA: string, ctaB: string): ExtraTokens {
  return { '--color-info': info, '--nc-glint': glint, '--nc-cta-a': ctaA, '--nc-cta-b': ctaB };
}

export const APPEARANCE_TOKENS: Record<AppearanceId, ExtraTokens> = {
  dark: tokens(NIGHT_INFO, '#F0D9FF', '#1C0F2C', '#0D0716'),
  light: tokens(DAY_INFO, '#C084FC', '#FFFFFF', '#F5EEFF'),
  'winter-night': tokens(NIGHT_INFO, '#CFFAFE', '#0E2236', '#05101E'),
  'winter-day': tokens(DAY_INFO, '#7DD3FC', '#FFFFFF', '#EEF6FB'),
  'spring-night': tokens(NIGHT_INFO, '#FFD6D8', '#1B4339', '#0A2420'),
  'spring-day': tokens(DAY_INFO, '#F29AA8', '#FFFFFF', '#FBF6EA'),
  'summer-night': tokens(NIGHT_INFO, '#FFE7A8', '#14344B', '#081A2A'),
  'summer-day': tokens(DAY_INFO, '#F2C46B', '#FFFFFF', '#EEF8F5'),
  'autumn-night': {
    ...tokens('115, 209, 255', '#FFE2A8', '#311B0E', '#160B05'),
    '--color-urgent-400': '255, 118, 174',
  },
  'autumn-day': tokens(DAY_INFO, '#F0A35A', '#FFFFFF', '#FBF1E4'),
};
