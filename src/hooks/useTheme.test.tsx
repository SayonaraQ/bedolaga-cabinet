// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '@/config/constants';
import { DEFAULT_ENABLED_THEMES, DEFAULT_THEME_COLORS } from '@/types/theme';
import { ThemeColorsProvider } from '@/providers/ThemeColorsProvider';
import { readSeasonalColorsHint, readThemeColorsHint } from '@/utils/themeColorsHint';
import { safeLocal } from '@/utils/safeStorage';
import { applyThemeColors, computeThemeCssVars } from './useThemeColors';
import { updateEnabledThemesCache, useTheme } from './useTheme';

const api = vi.hoisted(() => ({ getEnabledThemes: vi.fn(), getColors: vi.fn() }));
const platformTheme = vi.hoisted(() => ({
  setHeaderColor: vi.fn(),
  setBottomBarColor: vi.fn(),
  setBackgroundColor: vi.fn(),
}));
const telegram = vi.hoisted(() => ({ scheme: null as 'dark' | 'light' | null }));
vi.mock('@/api/themeColors', () => ({
  themeColorsApi: api,
  themeColorsQueryOptions: () => ({
    queryKey: ['theme-colors'],
    queryFn: api.getColors,
    retry: false,
  }),
}));
vi.mock('./useTelegramSDK', () => ({ getTelegramColorScheme: () => telegram.scheme }));
vi.mock('@/platform', () => ({
  usePlatform: () => ({ theme: platformTheme, capabilities: { hasThemeSync: true } }),
}));

const enabled = { ...DEFAULT_ENABLED_THEMES, seasonal: true };
const clients: QueryClient[] = [];
function renderThemes() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return renderHook(() => ({ first: useTheme(), second: useTheme() }), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>
        <ThemeColorsProvider>{children}</ThemeColorsProvider>
      </QueryClientProvider>
    ),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  document.documentElement.className = 'dark';
  document.documentElement.removeAttribute('style');
  delete document.documentElement.dataset.appearance;
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  api.getEnabledThemes.mockResolvedValue(enabled);
  api.getColors.mockResolvedValue(DEFAULT_THEME_COLORS);
  safeLocal.setJson(STORAGE_KEYS.ENABLED_THEMES, enabled);
  telegram.scheme = null;
});
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function css(name: string) {
  return document.documentElement.style.getPropertyValue(name);
}

describe('shared appearance hook and provider', () => {
  it('a late admin response and direct admin preview keep the seasonal palette and separate hints', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-12-01T12:00:00Z'));
    let finish!: (colors: typeof DEFAULT_THEME_COLORS) => void;
    api.getColors.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = renderThemes();
    await waitFor(() => expect(result.current.first.isLoading).toBe(false));
    expect(document.documentElement.dataset.appearance).toBe('winter-night');
    expect(css('--color-dark-bg')).toBe('#020914');
    const admin = {
      ...DEFAULT_THEME_COLORS,
      accent: '#123456',
      darkBackground: '#112233',
      success: '#00aa00',
    };
    await act(async () => finish(admin));
    await waitFor(() => expect(readThemeColorsHint()?.colors.accent).toBe(admin.accent));
    expect(css('--color-dark-bg')).toBe('#020914');
    expect(css('--color-accent-500')).toBe('34, 211, 238');
    expect(readThemeColorsHint()?.vars).toEqual(computeThemeCssVars(admin));
    expect(readSeasonalColorsHint()?.id).toBe('winter-night');
    expect(readSeasonalColorsHint()?.vars['--color-dark-bg']).toBe('#020914');
    expect(platformTheme.setHeaderColor).toHaveBeenLastCalledWith('#0A1D30');
    expect(platformTheme.setBackgroundColor).toHaveBeenLastCalledWith('#020914');
    act(() => applyThemeColors({ ...admin, accent: '#ff0000' }));
    expect(css('--color-accent-500')).toBe('34, 211, 238');
  });

  it('every consumer shares toggles, base changes and same-tab admin events', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-11T12:00:00Z'));
    const { result } = renderThemes();
    await waitFor(() => expect(result.current.first.isLoading).toBe(false));
    expect(api.getEnabledThemes).toHaveBeenCalledTimes(1);
    expect(css('--color-urgent-400')).toBe('255, 118, 174');
    act(() => result.current.second.toggleSeasonal());
    expect(result.current.first.seasonalActive).toBe(false);
    expect(document.documentElement.dataset.appearance).toBe('dark');
    expect(safeLocal.getItem(STORAGE_KEYS.SEASONAL)).toBe('off');
    expect(css('--color-urgent-400')).toBe('');
    expect(css('--nc-glint')).toBe('#F0D9FF');
    act(() => result.current.first.setSeasonal(true));
    act(() => result.current.second.toggleTheme());
    expect(result.current.first.theme).toBe('light');
    expect(document.documentElement.dataset.appearance).toBe('autumn-day');
    expect(css('--color-info')).toBe('2, 132, 199');
    act(() => updateEnabledThemesCache({ ...enabled, light: false, seasonal: false }));
    expect(result.current.second.theme).toBe('dark');
    expect(result.current.first.seasonalAvailable).toBe(false);
    expect(document.documentElement.dataset.appearance).toBe('dark');
    expect(safeLocal.getItem(STORAGE_KEYS.SEASONAL)).toBe('on');
  });

  it('cross-tab preferences, flags, and base theme updates reach all consumers', async () => {
    const { result } = renderThemes();
    await waitFor(() => expect(result.current.first.isLoading).toBe(false));
    const storage = (key: string, value: string) =>
      act(() => {
        safeLocal.setItem(key, value);
        window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }));
      });
    storage(STORAGE_KEYS.SEASONAL, 'off');
    expect(result.current.second.seasonalActive).toBe(false);
    storage(STORAGE_KEYS.THEME, 'light');
    expect(result.current.first.theme).toBe('light');
    storage(STORAGE_KEYS.ENABLED_THEMES, JSON.stringify({ dark: true, light: true }));
    expect(result.current.second.seasonalAvailable).toBe(false);
    expect(document.documentElement.dataset.appearance).toBe('light');
  });

  it('old cached and API flags make seasonal unavailable', async () => {
    safeLocal.setJson(STORAGE_KEYS.ENABLED_THEMES, { dark: true, light: true });
    api.getEnabledThemes.mockResolvedValue({ dark: true, light: true });
    const { result } = renderThemes();
    expect(result.current.first.seasonalAvailable).toBe(false);
    await waitFor(() => expect(result.current.first.isLoading).toBe(false));
    expect(result.current.second.enabledThemes).toEqual(DEFAULT_ENABLED_THEMES);
    expect(document.documentElement.dataset.appearance).toBe('dark');
  });

  it('a pending flags request cannot overwrite an admin update', async () => {
    let finish!: (value: typeof enabled) => void;
    api.getEnabledThemes.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = renderThemes();
    act(() => updateEnabledThemesCache({ ...enabled, seasonal: false }));
    await act(async () => finish(enabled));
    expect(result.current.first.seasonalAvailable).toBe(false);
    expect(safeLocal.getJson(STORAGE_KEYS.ENABLED_THEMES, enabled).seasonal).toBe(false);
  });

  it('uses the Telegram scheme and keeps disabled themes disabled', async () => {
    telegram.scheme = 'light';
    const { result } = renderThemes();
    await waitFor(() => expect(result.current.first.isLoading).toBe(false));
    expect(result.current.first.theme).toBe('light');
    act(() => updateEnabledThemesCache({ ...enabled, dark: false }));
    act(() => result.current.first.setTheme('dark'));
    expect(result.current.first.theme).toBe('light');
    expect(result.current.first.canToggle).toBe(false);
  });

  it.each([
    ['dark', 'light', true, 'dark'],
    ['light', 'dark', false, 'light'],
    [null, null, true, 'light'],
    [null, null, false, 'dark'],
  ] as const)(
    'base priority: stored=%s Telegram=%s systemLight=%s gives %s',
    async (stored, scheme, systemLight, expected) => {
      if (stored) safeLocal.setItem(STORAGE_KEYS.THEME, stored);
      telegram.scheme = scheme;
      vi.stubGlobal('matchMedia', () => ({
        matches: systemLight,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
      const { result } = renderThemes();
      await waitFor(() => expect(result.current.first.isLoading).toBe(false));
      expect(result.current.first.theme).toBe(expected);
      expect(result.current.second.theme).toBe(expected);
    },
  );

  it('follows system changes only without a stored preference', async () => {
    let change!: (event: { matches: boolean }) => void;
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: (_event: string, callback: typeof change) => {
        change = callback;
      },
      removeEventListener: vi.fn(),
    }));
    const { result } = renderThemes();
    await waitFor(() => expect(result.current.first.isLoading).toBe(false));
    act(() => change({ matches: true }));
    expect(result.current.first.theme).toBe('dark');
    safeLocal.removeItem(STORAGE_KEYS.THEME);
    act(() => change({ matches: true }));
    expect(result.current.first.theme).toBe('light');
    act(() => updateEnabledThemesCache({ ...enabled, dark: false }));
    safeLocal.removeItem(STORAGE_KEYS.THEME);
    act(() => change({ matches: false }));
    expect(result.current.first.theme).toBe('light');
  });

  it.each(['timer', 'focus', 'visibility'] as const)(
    'rechecks Moscow season on %s and cleans up its clock',
    async (trigger) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-11-30T20:59:30Z'));
      const { result, unmount } = renderThemes();
      await act(async () => {});
      expect(result.current.first.appearanceId).toBe('autumn-night');
      act(() => {
        if (trigger === 'timer') vi.advanceTimersByTime(60_000);
        else {
          vi.setSystemTime(new Date('2026-11-30T21:30:00Z'));
          if (trigger === 'focus') window.dispatchEvent(new Event('focus'));
          else document.dispatchEvent(new Event('visibilitychange'));
        }
      });
      expect(result.current.second.appearanceId).toBe('winter-night');
      expect(document.documentElement.dataset.appearance).toBe('winter-night');
      unmount();
      for (const client of clients) client.clear();
      await act(async () => vi.runOnlyPendingTimers());
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('does not poll while hidden and rechecks immediately when visible', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-30T20:59:30Z'));
    const visibility = vi.spyOn(document, 'visibilityState', 'get');
    const { result } = renderThemes();
    await act(async () => {});
    visibility.mockReturnValue('hidden');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.first.appearanceId).toBe('autumn-night');
    visibility.mockReturnValue('visible');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(result.current.first.appearanceId).toBe('winter-night');
  });
});
