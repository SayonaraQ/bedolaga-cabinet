// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import type { Season } from '@/theme/appearance';
import { SeasonDeviceGlyphs } from './SeasonDeviceGlyphs';

afterEach(cleanup);

const defaults = {
  season: 'winter' as Season,
  isLight: false,
  limit: 6,
  used: 5,
  zoneHex: '#12AB34',
  ghost: 'rgba(120, 130, 140, 0.2)',
};

function renderGlyphs(props: Partial<typeof defaults> = {}) {
  const { container } = render(<SeasonDeviceGlyphs {...defaults} {...props} />);
  const root = container.firstElementChild as HTMLDivElement;
  return { root, glyphs: [...root.querySelectorAll('svg')] };
}

it.each([
  ['autumn', 'maple'],
  ['winter', 'flake'],
  ['spring', 'blossom'],
  ['summer', 'palm'],
] as const)('uses the approved %s silhouette: %s', (season, kind) => {
  const { root, glyphs } = renderGlyphs({ season });
  expect(root.dataset.seasonGlyphs).toBe(season);
  expect(root.dataset.glyphKind).toBe(kind);
  expect(root.getAttribute('aria-hidden')).toBe('true');
  expect(root.classList.contains('flex-shrink-0')).toBe(true);
  for (const glyph of glyphs) {
    expect(glyph.getAttribute('width')).toBe('12');
    expect(glyph.getAttribute('height')).toBe('12');
    expect(glyph.getAttribute('viewBox')).toBe('0 0 24 24');
  }
});

it.each([
  [3, 1, 1],
  [10, 5, 5],
  [3, 8, 3],
  [3, -2, 0],
  [3, 0, 0],
] as const)('renders %i slots with used=%i clamped to %i connected', (limit, used, on) => {
  const { glyphs } = renderGlyphs({ limit, used });
  expect(glyphs).toHaveLength(limit);
  expect(glyphs.map((glyph) => glyph.dataset.glyphState)).toEqual([
    ...Array(on).fill('on'),
    ...Array(limit - on).fill('off'),
  ]);
});

for (const season of ['winter', 'spring'] as const) {
  it.each([false, true])(`uses the traffic-zone colour for ${season}, day=%s`, (isLight) => {
    const { glyphs } = renderGlyphs({ season, isLight });
    for (const [i, glyph] of glyphs.entries()) {
      const color = i < defaults.used ? defaults.zoneHex : defaults.ghost;
      if (season === 'winter') {
        expect(glyph.querySelector('path')?.getAttribute('stroke')).toBe(color);
      } else {
        const petals = [...glyph.querySelectorAll('circle')].slice(0, 5);
        expect(petals).toHaveLength(5);
        expect(petals.map((petal) => petal.getAttribute('fill'))).toEqual(Array(5).fill(color));
      }
    }
  });
}

const palettes = {
  autumn: {
    night: ['#FF9426', '#EA580C', '#FFB347', '#C2410C'],
    day: ['#E8771E', '#C2410C', '#D97706', '#B45309'],
  },
  summer: {
    night: ['#FFB38A', '#FFD27A', '#7DD3FC', '#FF8A65'],
    day: ['#F97316', '#F59E0B', '#0EA5E9', '#EF4444'],
  },
};
for (const season of ['autumn', 'summer'] as const) {
  it.each([false, true])(`cycles the approved ${season} palette, day=%s`, (isLight) => {
    const { glyphs } = renderGlyphs({ season, isLight });
    const palette = palettes[season][isLight ? 'day' : 'night'];
    for (const [i, glyph] of glyphs.entries()) {
      const color = i < defaults.used ? palette[i % palette.length] : defaults.ghost;
      const paths = [...glyph.querySelectorAll('path')];
      expect(paths).toHaveLength(2);
      expect(paths.map((path) => path.getAttribute('stroke'))).toEqual([color, color]);
      expect(glyph.querySelector('path:not([fill="none"])')?.getAttribute('fill')).toBe(color);
    }
  });
}

it.each([false, true])('adds a spring centre only to connected blossoms, day=%s', (isLight) => {
  const { glyphs } = renderGlyphs({ season: 'spring', isLight, limit: 2, used: 1 });
  expect(glyphs[0].querySelectorAll('circle')).toHaveLength(6);
  expect(glyphs[0].querySelector('circle[cx="12"][cy="12"]')?.getAttribute('fill')).toBe(
    isLight ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,.4)',
  );
  expect(glyphs[1].querySelectorAll('circle')).toHaveLength(5);
  expect(glyphs[1].querySelector('circle[cx="12"][cy="12"]')).toBeNull();
});

for (const season of ['autumn', 'winter', 'spring', 'summer'] as const) {
  it.each([false, true])(`glows only on connected ${season} glyphs at night, day=%s`, (isLight) => {
    const { glyphs } = renderGlyphs({ season, isLight, limit: 2, used: 1 });
    const color =
      season in palettes ? palettes[season as keyof typeof palettes].night[0] : defaults.zoneHex;
    expect(glyphs[0].style.filter).toBe(isLight ? '' : `drop-shadow(0 0 3px ${color}66)`);
    expect(glyphs[1].style.filter).toBe('');
  });
}

it.each(['autumn', 'winter', 'spring', 'summer'] as const)(
  'tilts alternating glyphs only in autumn: %s',
  (season) => {
    const { glyphs } = renderGlyphs({ season, limit: 3 });
    expect(glyphs.map((glyph) => glyph.style.transform)).toEqual(
      season === 'autumn' ? ['rotate(-8deg)', 'rotate(8deg)', 'rotate(-8deg)'] : ['', '', ''],
    );
  },
);

it.each([1, 5, 6, 10])(
  'lays out %i glyphs in five columns above five slots, otherwise flex',
  (limit) => {
    const { root } = renderGlyphs({ limit });
    expect(root.style.display).toBe(limit > 5 ? 'grid' : 'flex');
    expect(root.style.gridTemplateColumns).toBe(limit > 5 ? 'repeat(5, 12px)' : '');
    expect(root.style.gap).toBe(limit > 5 ? '4px' : '5px');
  },
);
