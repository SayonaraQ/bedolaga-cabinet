import { describe, expect, it } from 'vitest';
import { applyThemeGround } from './BackgroundRenderer';

/**
 * Анимированная подложка кроет весь вьюпорт и заливается непрозрачным цветом,
 * а цвет этот — одна настройка на обе темы, которую оператор задаёт под тёмную.
 * При включении светлой темы страница из-за этого стала чёрной со светлыми
 * карточками поверх: карточки красятся токенами и перевернулись, а холст нет.
 *
 * Тест держит подстановку и её границы. Ловушка на будущее: подставлять
 * только там, где ground вообще есть, и никогда — в тёмной теме.
 */

describe('applyThemeGround', () => {
  const vortex = { particleCount: 300, baseHue: 220, backgroundColor: '#000000' };

  it('в светлой теме подменяет ground фоном страницы', () => {
    expect(applyThemeGround(vortex, true, '#eeecf4')).toEqual({
      particleCount: 300,
      baseHue: 220,
      backgroundColor: '#eeecf4',
    });
  });

  it('в тёмной теме оставляет цвет оператора нетронутым', () => {
    expect(applyThemeGround(vortex, false, '#eeecf4')).toBe(vortex);
  });

  it('не выдумывает ground тем фонам, у которых его нет', () => {
    // У большинства фонов холст прозрачный: добавить им backgroundColor
    // значит закрасить страницу тем, чего они никогда не рисовали.
    const transparent = { starCount: 200, twinkle: true };
    expect(applyThemeGround(transparent, true, '#eeecf4')).toBe(transparent);
  });

  it('не мутирует исходные настройки', () => {
    const original = { ...vortex };
    applyThemeGround(vortex, true, '#eeecf4');
    expect(vortex).toEqual(original);
  });
});
