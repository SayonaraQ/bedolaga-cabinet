// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import htmlSource from '../../index.html?raw';
import { STORAGE_KEYS } from '@/config/constants';
import { DEFAULT_THEME_COLORS } from '@/types/theme';
import { resolveAppearance, type BaseTheme, type SeasonalPreference } from '@/theme/appearance';
import { readThemeColorsHint, writeThemeColorsHint } from './themeColorsHint';

/**
 * Палитра оператора приходит с бэкенда уже после первой отрисовки, и каждая
 * загрузка сначала показывала цвета по умолчанию (синий акцент, синеватый фон),
 * а потом прыгала в операторские. Подсказка в localStorage хранит последнюю
 * применённую палитру, а инлайн-скрипт index.html ставит её на :root до того,
 * как загрузится приложение.
 */

const VARS = {
  '--color-accent-500': '20, 184, 166',
  '--color-dark-950': '10, 20, 16',
  '--color-champagne-200': '247, 231, 206',
  '--color-on-accent': '255, 255, 255',
  '--color-dark-bg': '#0a1410',
};

function inlineHintScript(): string {
  const match = htmlSource.match(/<script data-hint="theme-colors">([\s\S]*?)<\/script>/);
  if (!match) throw new Error('index.html: нет инлайн-скрипта data-hint="theme-colors"');
  return match[1];
}

function runInlineScript(): void {
  new Function(inlineHintScript())();
}

function rootVar(name: string): string {
  return document.documentElement.style.getPropertyValue(name).trim();
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('style');
  document.head.innerHTML = '';
  delete document.documentElement.dataset.appearance;
});

afterEach(() => {
  document.documentElement.removeAttribute('style');
  document.head.innerHTML = '';
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('themeColorsHint: запись и чтение', () => {
  it('читает ровно то, что записал', () => {
    writeThemeColorsHint({ colors: DEFAULT_THEME_COLORS, vars: VARS });
    expect(readThemeColorsHint()).toEqual({ colors: DEFAULT_THEME_COLORS, vars: VARS });
  });

  it('без подсказки и на битом JSON возвращает null', () => {
    expect(readThemeColorsHint()).toBeNull();
    localStorage.setItem(STORAGE_KEYS.THEME_COLORS_HINT, '{not json');
    expect(readThemeColorsHint()).toBeNull();
  });

  it('отбрасывает подсказку с неполными или не-hex цветами', () => {
    localStorage.setItem(
      STORAGE_KEYS.THEME_COLORS_HINT,
      JSON.stringify({ colors: { ...DEFAULT_THEME_COLORS, accent: 'red' }, vars: VARS }),
    );
    expect(readThemeColorsHint()).toBeNull();
    const { accent: _dropped, ...withoutAccent } = DEFAULT_THEME_COLORS;
    localStorage.setItem(
      STORAGE_KEYS.THEME_COLORS_HINT,
      JSON.stringify({ colors: withoutAccent, vars: VARS }),
    );
    expect(readThemeColorsHint()).toBeNull();
  });

  it('отбрасывает переменные с чужими именами или значениями', () => {
    localStorage.setItem(
      STORAGE_KEYS.THEME_COLORS_HINT,
      JSON.stringify({
        colors: DEFAULT_THEME_COLORS,
        vars: { ...VARS, '--font-sans': 'serif', '--color-x': 'url(evil)' },
      }),
    );
    expect(readThemeColorsHint()?.vars).toEqual(VARS);
  });
});

function runAppearanceScript() {
  const match = htmlSource.match(/<script data-hint="appearance">([\s\S]*?)<\/script>/);
  if (!match) throw new Error('index.html: missing appearance script');
  new Function(match[1])();
}

describe('first paint: seasonal appearance', () => {
  it('keeps both first-paint scripts ES5-safe', () => {
    const appearance = htmlSource.match(/<script data-hint="appearance">([\s\S]*?)<\/script>/)?.[1];
    expect(appearance).toBeTruthy();
    for (const source of [appearance, inlineHintScript()]) {
      expect(source).not.toMatch(/=>|\b(?:let|const)\b|\?\./);
    }
  });
  it.each([
    ['dark', true, true, null, '2026-11-30T21:30:00Z'],
    ['light', true, true, null, '2026-11-30T21:30:00Z'],
    ['dark', true, true, 'off', '2026-04-01T00:00:00Z'],
    ['dark', true, false, null, '2026-07-01T00:00:00Z'],
    ['light', true, false, 'on', '2026-10-01T00:00:00Z'],
    ['dark', false, true, 'on', '2026-01-01T00:00:00Z'],
  ] as const)(
    'matches the resolver: %s, available=%s, default=%s, pref=%s, now=%s',
    (base: BaseTheme, seasonal, seasonalDefault, pref: SeasonalPreference, time) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      const now = new Date(time);
      vi.setSystemTime(now);
      localStorage.setItem(STORAGE_KEYS.THEME, base);
      localStorage.setItem(
        STORAGE_KEYS.ENABLED_THEMES,
        JSON.stringify({ dark: true, light: true, seasonal, seasonalDefault }),
      );
      if (pref) localStorage.setItem(STORAGE_KEYS.SEASONAL, pref);
      runAppearanceScript();
      expect(document.documentElement.dataset.appearance).toBe(
        resolveAppearance({ base, flags: { seasonal, seasonalDefault }, pref, now }).id,
      );
      expect(document.documentElement.classList.contains(base)).toBe(true);
    },
  );

  it.each(['winter-night', 'autumn-night'])(
    'only uses the seasonal hint when its id matches: %s',
    (hintId) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-30T21:30:00Z'));
      localStorage.setItem(STORAGE_KEYS.THEME, 'dark');
      localStorage.setItem(
        STORAGE_KEYS.ENABLED_THEMES,
        JSON.stringify({ dark: true, light: true, seasonal: true }),
      );
      writeThemeColorsHint({ colors: DEFAULT_THEME_COLORS, vars: VARS });
      localStorage.setItem(
        STORAGE_KEYS.SEASONAL_HINT,
        JSON.stringify({
          id: hintId,
          vars: {
            '--color-accent-500': '34, 211, 238',
            '--color-dark-bg': '#020914',
            '--font-sans': 'serif',
            '--color-evil': 'url(evil)',
          },
        }),
      );
      runAppearanceScript();
      runInlineScript();
      expect(document.documentElement.dataset.appearance).toBe('winter-night');
      expect(rootVar('--color-accent-500')).toBe(
        hintId === 'winter-night' ? '34, 211, 238' : VARS['--color-accent-500'],
      );
      expect(rootVar('--font-sans')).toBe('');
      expect(rootVar('--color-evil')).toBe('');
    },
  );

  it('old flags do not activate seasonal hints; broken seasonal JSON falls back to admin', () => {
    localStorage.setItem(STORAGE_KEYS.THEME, 'dark');
    localStorage.setItem(STORAGE_KEYS.ENABLED_THEMES, JSON.stringify({ dark: true, light: true }));
    localStorage.setItem(STORAGE_KEYS.SEASONAL_HINT, '{broken');
    writeThemeColorsHint({ colors: DEFAULT_THEME_COLORS, vars: VARS });
    runAppearanceScript();
    runInlineScript();
    expect(document.documentElement.dataset.appearance).toBe('dark');
    expect(rootVar('--color-accent-500')).toBe(VARS['--color-accent-500']);
  });

  it('stays safe with blocked storage and applies the system base', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      expect(() => {
        runAppearanceScript();
        runInlineScript();
      }).not.toThrow();
      expect(document.documentElement.dataset.appearance).toBe('light');
    } finally {
      getItem.mockRestore();
    }
  });
});

describe('themeColorsHint: инлайн-скрипт index.html', () => {
  it('ключ хранилища в скрипте совпадает с STORAGE_KEYS', () => {
    expect(inlineHintScript()).toContain(`'${STORAGE_KEYS.THEME_COLORS_HINT}'`);
  });

  it('ставит переменные палитры на :root и фон страницы до загрузки приложения', () => {
    writeThemeColorsHint({ colors: DEFAULT_THEME_COLORS, vars: VARS });
    runInlineScript();
    expect(rootVar('--color-accent-500')).toBe('20, 184, 166');
    expect(rootVar('--color-dark-950')).toBe('10, 20, 16');
    expect(rootVar('--color-dark-bg')).toBe('#0a1410');
    const style = document.head.querySelector('style');
    expect(style?.textContent).toContain('body');
    expect(style?.textContent).toContain('rgb(10, 20, 16)');
    expect(style?.textContent).toContain('rgb(247, 231, 206)');
  });

  it('без подсказки ничего не трогает', () => {
    runInlineScript();
    expect(document.documentElement.getAttribute('style')).toBeNull();
    expect(document.head.querySelector('style')).toBeNull();
  });

  it('пропускает чужие имена и значения и не падает на мусоре', () => {
    localStorage.setItem(
      STORAGE_KEYS.THEME_COLORS_HINT,
      JSON.stringify({
        colors: DEFAULT_THEME_COLORS,
        vars: { '--color-accent-500': '1, 2, 3', '--font-sans': 'serif', '--color-x': 'url(evil)' },
      }),
    );
    expect(() => runInlineScript()).not.toThrow();
    expect(rootVar('--color-accent-500')).toBe('1, 2, 3');
    expect(rootVar('--font-sans')).toBe('');
    expect(rootVar('--color-x')).toBe('');

    localStorage.setItem(STORAGE_KEYS.THEME_COLORS_HINT, '{not json');
    expect(() => runInlineScript()).not.toThrow();
  });
});
