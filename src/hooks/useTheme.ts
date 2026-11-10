import { useSyncExternalStore } from 'react';
import { normalizeEnabledThemes, type EnabledThemes } from '../types/theme';
import { themeColorsApi } from '../api/themeColors';
import { STORAGE_KEYS } from '../config/constants';
import { safeLocal } from '../utils/safeStorage';
import { getTelegramColorScheme } from './useTelegramSDK';
import {
  resolveAppearance,
  seasonFor,
  type BaseTheme,
  type SeasonalPreference,
} from '@/theme/appearance';

const ENABLED_THEMES_CHANGED_EVENT = 'enabledThemesChanged';
const THEME_CHANGED_EVENT = 'themeChanged';
const SEASONAL_CHANGED_EVENT = 'seasonalChanged';

function getCachedEnabledThemes(): EnabledThemes {
  return normalizeEnabledThemes(safeLocal.getJson<unknown>(STORAGE_KEYS.ENABLED_THEMES, null));
}

function readSeasonalPreference(): SeasonalPreference {
  const value = safeLocal.getItem(STORAGE_KEYS.SEASONAL);
  return value === 'on' || value === 'off' ? value : null;
}

function initialTheme(enabled: EnabledThemes): BaseTheme {
  const stored = safeLocal.getItem(STORAGE_KEYS.THEME);
  if (stored === 'dark' || stored === 'light') {
    return enabled[stored] ? stored : enabled.dark ? 'dark' : 'light';
  }
  if (!stored) {
    const telegram = getTelegramColorScheme();
    if (telegram && enabled[telegram]) return telegram;
  }
  if (window.matchMedia('(prefers-color-scheme: light)').matches && enabled.light) return 'light';
  return enabled.dark ? 'dark' : 'light';
}

interface ThemeSnapshot {
  theme: BaseTheme;
  enabledThemes: EnabledThemes;
  pref: SeasonalPreference;
  now: Date;
  isLoading: boolean;
}

// One snapshot, request and clock per tab, regardless of the number of consumers.
let snapshot: ThemeSnapshot | undefined;
const listeners = new Set<() => void>();
let stopListening: (() => void) | undefined;
let flagsRevision = 0;
let requestRevision = 0;

function getSnapshot(): ThemeSnapshot {
  if (!snapshot) {
    const enabledThemes = getCachedEnabledThemes();
    snapshot = {
      theme: initialTheme(enabledThemes),
      enabledThemes,
      pref: readSeasonalPreference(),
      now: new Date(),
      isLoading: true,
    };
  }
  return snapshot;
}

function publish(patch: Partial<ThemeSnapshot>) {
  snapshot = { ...getSnapshot(), ...patch };
  for (const listener of listeners) listener();
}

function applyBaseTheme(theme: BaseTheme) {
  document.documentElement.classList.toggle('light', theme === 'light');
  document.documentElement.classList.toggle('dark', theme === 'dark');
  safeLocal.setItem(STORAGE_KEYS.THEME, theme);
}

function acceptTheme(theme: BaseTheme) {
  const current = getSnapshot();
  if (!current.enabledThemes[theme]) return;
  applyBaseTheme(theme);
  if (theme !== current.theme) publish({ theme });
}

function acceptEnabledThemes(raw: unknown) {
  flagsRevision++;
  const enabledThemes = normalizeEnabledThemes(raw);
  const current = getSnapshot();
  const theme = enabledThemes[current.theme]
    ? current.theme
    : enabledThemes.dark
      ? 'dark'
      : 'light';
  applyBaseTheme(theme);
  publish({ enabledThemes, theme, isLoading: false });
}

export function updateEnabledThemesCache(themes: EnabledThemes) {
  const data = normalizeEnabledThemes(themes);
  safeLocal.setJson(STORAGE_KEYS.ENABLED_THEMES, data);
  window.dispatchEvent(new CustomEvent(ENABLED_THEMES_CHANGED_EVENT, { detail: data }));
}

async function refreshEnabledThemes() {
  const request = ++requestRevision;
  const revision = flagsRevision;
  let data: EnabledThemes;
  try {
    data = normalizeEnabledThemes(await themeColorsApi.getEnabledThemes());
  } catch {
    data = getCachedEnabledThemes();
  }
  // An admin edit or a newer request wins over an already pending response.
  if (!listeners.size || request !== requestRevision || revision !== flagsRevision) return;
  updateEnabledThemesCache(data);
}

function startListening() {
  const onTheme = (event: Event) => acceptTheme((event as CustomEvent<BaseTheme>).detail);
  const onFlags = (event: Event) => acceptEnabledThemes((event as CustomEvent).detail);
  const onSeasonal = () => publish({ pref: readSeasonalPreference(), now: new Date() });
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEYS.ENABLED_THEMES || event.key === null) {
      acceptEnabledThemes(getCachedEnabledThemes());
    }
    if (event.key === STORAGE_KEYS.THEME || event.key === null) {
      acceptTheme(initialTheme(getSnapshot().enabledThemes));
    }
    if (event.key === STORAGE_KEYS.SEASONAL || event.key === null) onSeasonal();
  };
  const recheckSeason = () => {
    const now = new Date();
    if (seasonFor(now) !== seasonFor(getSnapshot().now)) publish({ now });
  };
  let timer: ReturnType<typeof setInterval> | undefined;
  const onVisibility = () => {
    clearInterval(timer);
    timer = undefined;
    if (document.visibilityState !== 'hidden') {
      recheckSeason();
      timer = setInterval(recheckSeason, 60_000);
    }
  };
  const media = window.matchMedia('(prefers-color-scheme: light)');
  const onSystemTheme = (event: MediaQueryListEvent) => {
    if (!safeLocal.getItem(STORAGE_KEYS.THEME)) acceptTheme(event.matches ? 'light' : 'dark');
  };
  window.addEventListener(THEME_CHANGED_EVENT, onTheme);
  window.addEventListener(ENABLED_THEMES_CHANGED_EVENT, onFlags);
  window.addEventListener(SEASONAL_CHANGED_EVENT, onSeasonal);
  window.addEventListener('storage', onStorage);
  window.addEventListener('focus', recheckSeason);
  document.addEventListener('visibilitychange', onVisibility);
  media.addEventListener('change', onSystemTheme);
  applyBaseTheme(getSnapshot().theme);
  onVisibility();
  void refreshEnabledThemes();
  return () => {
    requestRevision++;
    clearInterval(timer);
    window.removeEventListener(THEME_CHANGED_EVENT, onTheme);
    window.removeEventListener(ENABLED_THEMES_CHANGED_EVENT, onFlags);
    window.removeEventListener(SEASONAL_CHANGED_EVENT, onSeasonal);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('focus', recheckSeason);
    document.removeEventListener('visibilitychange', onVisibility);
    media.removeEventListener('change', onSystemTheme);
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) stopListening = startListening();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      stopListening?.();
      stopListening = undefined;
      snapshot = undefined;
    }
  };
}

function setTheme(theme: BaseTheme) {
  if (getSnapshot().enabledThemes[theme]) {
    window.dispatchEvent(new CustomEvent(THEME_CHANGED_EVENT, { detail: theme }));
  }
}

function toggleTheme() {
  setTheme(getSnapshot().theme === 'dark' ? 'light' : 'dark');
}

function setSeasonal(active: boolean) {
  safeLocal.setItem(STORAGE_KEYS.SEASONAL, active ? 'on' : 'off');
  window.dispatchEvent(new Event(SEASONAL_CHANGED_EVENT));
}

function toggleSeasonal() {
  const current = getSnapshot();
  const appearance = resolveAppearance({
    base: current.theme,
    flags: current.enabledThemes,
    pref: current.pref,
    now: current.now,
  });
  setSeasonal(!appearance.seasonalActive);
}

export function useTheme() {
  const current = useSyncExternalStore(subscribe, getSnapshot);
  const { theme, enabledThemes, isLoading } = current;
  const appearance = resolveAppearance({
    base: theme,
    flags: enabledThemes,
    pref: current.pref,
    now: current.now,
  });
  return {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === 'dark',
    isLight: theme === 'light',
    enabledThemes,
    canToggle: !isLoading && enabledThemes.dark && enabledThemes.light,
    isLoading,
    refreshEnabledThemes,
    appearanceId: appearance.id,
    season: appearance.season,
    seasonalActive: appearance.seasonalActive,
    seasonalAvailable: enabledThemes.seasonal,
    toggleSeasonal,
    setSeasonal,
  };
}
