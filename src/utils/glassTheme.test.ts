import { describe, expect, it } from 'vitest';
import { getGlassColors } from './glassTheme';

/**
 * Стеклянные карточки (дашборд, подписки) раньше красили текст зашитыми
 * белым/чёрным по isDark и не видели операторский цвет текста. Токены текста
 * обязаны идти через переменные темы.
 *
 * Второе требование появилось 2026-09-08: вторичный текст нельзя красить долей
 * основного цвета. Доли 0.4 / 0.3 / 0.25 давали контраст 3.4 и ниже — подписи в
 * карточке подписки читались с трудом. Такой текст берёт клампованные по
 * контрасту токены dark-400 / dark-500.
 */
describe('getGlassColors', () => {
  it('uses the dark surface palette for glass instead of a white overlay', () => {
    expect(getGlassColors(true)).toMatchObject({
      cardBg:
        'linear-gradient(160deg, rgba(var(--color-dark-800), 0.84) 0%, rgba(var(--color-dark-900), 0.9) 100%)',
      cardBorder: 'rgba(var(--color-accent-400), 0.18)',
      innerBg: 'rgba(var(--color-dark-950), 0.42)',
      innerBorder: 'rgba(255,255,255,0.07)',
    });
  });

  it('uses the champagne surface palette for light glass', () => {
    expect(getGlassColors(false)).toMatchObject({
      cardBg:
        'linear-gradient(145deg, rgba(var(--color-champagne-50), 0.95) 0%, rgba(var(--color-champagne-50), 0.88) 100%)',
      cardBorder: 'rgba(0,0,0,0.1)',
      innerBg: 'rgba(0,0,0,0.03)',
      innerBorder: 'rgba(0,0,0,0.06)',
    });
  });

  it.each([true, false])('текстовые токены берут цвет из темы (isDark=%s)', (isDark) => {
    const g = getGlassColors(isDark);
    for (const token of [g.text, g.textSecondary, g.textMuted, g.textFaint, g.textGhost]) {
      expect(token).toMatch(/var\(--color-dark-\d+\)/);
    }
  });

  it.each([true, false])(
    'вторичный текст — сплошной токен, а не прозрачность (isDark=%s)',
    (isDark) => {
      const g = getGlassColors(isDark);
      expect(g.textSecondary).toBe('rgb(var(--color-dark-400))');
      expect(g.textMuted).toBe('rgb(var(--color-dark-500))');
      expect(g.textFaint).toBe('rgb(var(--color-dark-500))');
    },
  );

  it('декоративный призрачный слой остаётся прозрачным — это фон, а не текст', () => {
    expect(getGlassColors(true).textGhost).toContain('rgba(');
  });
});
