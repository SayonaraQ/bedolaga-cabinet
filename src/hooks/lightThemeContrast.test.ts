// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { applyThemeColors } from './useThemeColors';
import { DEFAULT_THEME_COLORS } from '../types/theme';

/**
 * Контраст светлой темы. Держит два решения, которые иначе выглядят
 * произвольными и однажды будут «упрощены» обратно.
 *
 * 1. `.light` подменяет текстовые оттенки статусов 300/400 → 700 для синего
 *    и красного, но → 800 для зелёного и жёлтого. Причина здесь и проверяется:
 *    на 700 зелёный и жёлтый не добирают до 4.5 ни на одной разумной светлой
 *    палитре, а синий и красный проходят с запасом и на 800 читались бы уже
 *    почти чёрными.
 *
 * 2. Подпись на залитой кнопке берётся из `--color-on-*`, а не из шкалы
 *    dark-*. В светлой теме `dark-950` — это фон страницы, и на жёлтой
 *    кнопке он даёт нечитаемое.
 *
 * Проверяется на нескольких палитрах, а не на одной: оператор задаёт светлые
 * цвета из админки, поэтому свойство должно держаться на диапазоне, а не на
 * конкретных значениях. Реальные цвета прода лежат в БД бота
 * (`system_settings.CABINET_THEME_COLORS`), не в этом репозитории.
 */

type Rgb = { r: number; g: number; b: number };

function triplet(name: string): Rgb {
  const [r, g, b] = document.documentElement.style
    .getPropertyValue(name)
    .split(',')
    .map((x) => Number(x.trim()));
  return { r, g, b };
}

function luminance({ r, g, b }: Rgb): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Светлые палитры, между которыми оператор реально может выбирать. */
const LIGHT_PALETTES: Record<string, Record<string, string>> = {
  'серый (дефолт апстрима)': {
    lightBackground: '#e5e7eb',
    lightSurface: '#f3f4f6',
    lightText: '#111827',
    lightTextSecondary: '#4b5563',
  },
  'холодный нейтральный': {
    lightBackground: '#eceef3',
    lightSurface: '#ffffff',
    lightText: '#16181f',
    lightTextSecondary: '#5a6072',
  },
  'фиолетовый уклон': {
    lightBackground: '#eeecf4',
    lightSurface: '#fbfaff',
    lightText: '#1a1723',
    lightTextSecondary: '#5d5870',
  },
  'тёплая бумага': {
    lightBackground: '#f2ece2',
    lightSurface: '#fffdf9',
    lightText: '#1f1a14',
    lightTextSecondary: '#6b6152',
  },
};

const WCAG_BODY_TEXT = 4.5;

function applyLight(light: Record<string, string>): void {
  applyThemeColors({ ...DEFAULT_THEME_COLORS, ...light, accent: '#a855f7' });
}

describe('контраст светлой темы', () => {
  it.each(Object.entries(LIGHT_PALETTES))(
    'на палитре «%s» основной и вторичный текст читаются',
    (_label, light) => {
      applyLight(light);
      const surface = triplet('--color-champagne-50');

      // champagne-950 ← lightText, champagne-600 ← lightTextSecondary
      expect(contrast(triplet('--color-champagne-950'), surface)).toBeGreaterThanOrEqual(
        WCAG_BODY_TEXT,
      );
      expect(contrast(triplet('--color-champagne-600'), surface)).toBeGreaterThanOrEqual(
        WCAG_BODY_TEXT,
      );
    },
  );

  it.each(Object.entries(LIGHT_PALETTES))(
    'на палитре «%s» зелёный и жёлтый читаются только на 800',
    (_label, light) => {
      applyLight(light);
      const surface = triplet('--color-champagne-50');

      for (const status of ['success', 'warning'] as const) {
        // Ровно причина ремапа: 700 не добирает, 800 добирает.
        expect(contrast(triplet(`--color-${status}-700`), surface)).toBeLessThan(WCAG_BODY_TEXT);
        expect(contrast(triplet(`--color-${status}-800`), surface)).toBeGreaterThanOrEqual(
          WCAG_BODY_TEXT,
        );
      }
    },
  );

  it.each(Object.entries(LIGHT_PALETTES))(
    'на палитре «%s» синий и красный проходят уже на 700',
    (_label, light) => {
      applyLight(light);
      const surface = triplet('--color-champagne-50');

      for (const status of ['accent', 'error'] as const) {
        expect(contrast(triplet(`--color-${status}-700`), surface)).toBeGreaterThanOrEqual(
          WCAG_BODY_TEXT,
        );
      }
    },
  );

  it('подпись на залитой кнопке берётся из on-* и читается', () => {
    applyLight(LIGHT_PALETTES['фиолетовый уклон']);

    for (const status of ['accent', 'success', 'warning', 'error'] as const) {
      const fill = triplet(`--color-${status}-500`);
      const on = triplet(`--color-on-${status}`);
      expect(contrast(on, fill)).toBeGreaterThanOrEqual(WCAG_BODY_TEXT);
    }

    // А dark-950 — то, чем подпись была написана до правки, — в светлой теме
    // равен фону страницы, и на жёлтой кнопке нечитаем.
    const pageBackground = triplet('--color-champagne-200');
    expect(contrast(pageBackground, triplet('--color-warning-500'))).toBeLessThan(2);
  });
});
