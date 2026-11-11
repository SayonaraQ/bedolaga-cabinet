// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockSceneMedia } from '@/test/sceneMedia';
import { SEASONAL_PALETTES, type SeasonalAppearanceId } from '@/theme/appearance';
import HaloBackground from './halo';
import LiquidLightBackground from './liquid-light';
import SeasonalBackground, { SCENES } from './seasonal';
import StardustBackground from './stardust';
import { STATIC_SCENE_TYPES } from './types';

const theme = vi.hoisted(() => ({ isLight: false }));
vi.mock('@/hooks/useTheme', () => ({ useTheme: () => theme }));

let changeMedia: ReturnType<typeof mockSceneMedia>;
beforeEach(() => {
  theme.isLight = false;
  vi.stubGlobal('innerWidth', 1024);
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  changeMedia = mockSceneMedia();
  // jsdom's CSS parser drops long shadow lists at its iteration limit.
  const shadows = new WeakMap<CSSStyleDeclaration, string>();
  const styles = Object.getPrototypeOf(document.createElement('div').style) as CSSStyleDeclaration;
  vi.spyOn(styles, 'boxShadow', 'set').mockImplementation(function (
    this: CSSStyleDeclaration,
    value: string,
  ) {
    shadows.set(this, value);
  });
  vi.spyOn(styles, 'boxShadow', 'get').mockImplementation(function (this: CSSStyleDeclaration) {
    return shadows.get(this) ?? '';
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const appearances = Object.keys(SEASONAL_PALETTES) as SeasonalAppearanceId[];
describe('SeasonalBackground', () => {
  it.each(appearances)('renders separate glow and aurora layers for %s', (appearance) => {
    const { container } = render(<SeasonalBackground appearance={appearance} />);
    const aurora = appearance === 'winter-night' || appearance === 'winter-day';
    const glow =
      appearance === 'winter-night' ||
      appearance.startsWith('spring-') ||
      appearance.startsWith('autumn-');
    expect(container.querySelectorAll('.scene-aurora')).toHaveLength(aurora ? 1 : 0);
    expect(container.querySelectorAll('.scene-glow')).toHaveLength(glow ? 1 : 0);
    const layers = [...container.querySelectorAll('[data-scene] > *')];
    const expected = [...(glow ? ['scene-glow'] : []), ...(aurora ? ['scene-aurora'] : [])];
    expect(layers.slice(0, expected.length).map((layer) => layer.className)).toEqual(expected);
  });

  it.each(appearances)('keeps any aurora gradients in the top band for %s', (appearance) => {
    const { container } = render(<SeasonalBackground appearance={appearance} />);
    const aurora = container.querySelector<HTMLElement>('.scene-aurora');
    if (!aurora) return;
    // jsdom can drop ellipse gradients, so check the original background string.
    const positions = [...(SCENES[appearance].aurora ?? '').matchAll(/at\s+[\d.]+%\s+([\d.]+)%/g)];
    expect(positions.length).toBeGreaterThan(0);
    for (const position of positions) {
      expect(Number(position[1])).toBeLessThanOrEqual(30);
    }
  });

  it('keeps corner glows static across the full viewport', () => {
    const css = readFileSync(join(__dirname, 'scene-backgrounds.css'), 'utf8');
    const glowRule = css.match(/\.scene-glow\s*\{([^}]*)\}/)?.[1];
    expect(glowRule).toBeDefined();
    expect(glowRule).toMatch(/\bposition:\s*absolute\s*;/);
    expect(glowRule).toMatch(/\binset:\s*0\s*;/);
    expect(glowRule).not.toMatch(/\b(?:animation(?:-[\w-]+)?|transform|translate|scale)\s*:/);
  });

  it.each(appearances)('renders the reference scene and desktop count for %s', (appearance) => {
    const { container } = render(<SeasonalBackground appearance={appearance} />);
    expect(container.querySelector('[data-scene]')?.getAttribute('data-scene')).toBe(appearance);
    const count = appearance.startsWith('winter') ? 44 : appearance.startsWith('summer') ? 9 : 16;
    expect(container.querySelectorAll('[data-particle]')).toHaveLength(count);
    expect(container.querySelectorAll('.scene-orb')).toHaveLength(
      appearance.startsWith('summer') ? 1 : 0,
    );
    expect(container.querySelector('canvas')).toBeNull();
  });

  it.each(appearances)('halves particles below 768px for %s', (appearance) => {
    vi.stubGlobal('innerWidth', 767);
    const { container } = render(<SeasonalBackground appearance={appearance} />);
    const count = appearance.startsWith('winter') ? 22 : appearance.startsWith('summer') ? 4 : 8;
    expect(container.querySelectorAll('[data-particle]')).toHaveLength(count);
  });

  it('keeps seeded positions across rerenders and responds to the mobile breakpoint', () => {
    const { container, rerender } = render(<SeasonalBackground appearance="winter-night" />);
    const positions = () =>
      [...container.querySelectorAll('[data-particle]')].map((node) => node.getAttribute('style'));
    const original = positions();
    rerender(<SeasonalBackground appearance="winter-night" paused />);
    expect(positions()).toEqual(original);
    act(() => changeMedia('(max-width: 767px)', true));
    expect(positions()).toEqual(original.slice(0, 22));
    act(() => changeMedia('(max-width: 767px)', false));
    expect(positions()).toEqual(original);
  });
});

describe('LiquidLightBackground', () => {
  it('renders the three reference blobs and timings over the dark ground', () => {
    const { container } = render(<LiquidLightBackground settings={{}} />);
    const scene = container.querySelector<HTMLElement>('[data-scene]');
    const blobs = [...container.querySelectorAll<HTMLElement>('.scene-blob')];
    // Ground follows the palette background token, not a hard-coded colour.
    expect(scene?.style.background).toBe('rgb(var(--color-dark-950))');
    expect(blobs).toHaveLength(3);
    expect(blobs.map((blob) => blob.style.animationDuration)).toEqual(['24s', '19s', '28s']);
    expect(blobs.map((blob) => blob.style.backgroundColor)).toEqual([
      'rgb(147, 51, 234)',
      'rgb(214, 140, 255)',
      'rgb(126, 34, 206)',
    ]);
    expect(blobs.map((blob) => blob.style.opacity)).toEqual(['0.55', '0.32', '0.48']);
    expect(blobs.every((blob) => blob.style.mixBlendMode === 'screen')).toBe(true);
  });

  it('keeps the light palette visible with faint lavender blobs and no opaque dark ground', () => {
    theme.isLight = true;
    const { container } = render(
      <LiquidLightBackground settings={{ backgroundColor: '#000000' }} />,
    );
    expect(container.querySelector<HTMLElement>('[data-scene]')?.style.background).toBe(
      'transparent',
    );
    const blobs = [...container.querySelectorAll<HTMLElement>('.scene-blob')];
    expect(blobs).toHaveLength(2);
    expect(blobs.map((blob) => blob.style.opacity)).toEqual(['0.13', '0.16']);
    expect(blobs.every((blob) => blob.style.mixBlendMode === 'normal')).toBe(true);
  });

  it('sanitizes colours and applies only supported speed values', () => {
    const { container, rerender } = render(
      <LiquidLightBackground
        settings={{ color1: 'red; background:url(bad)', color2: '#123456', speed: 'fast' }}
      />,
    );
    const blobs = () => [...container.querySelectorAll<HTMLElement>('.scene-blob')];
    expect(blobs()[0].style.backgroundColor).toBe('rgb(147, 51, 234)');
    expect(blobs()[1].style.backgroundColor).toBe('rgb(18, 52, 86)');
    expect(blobs().map((blob) => blob.style.animationDuration)).toEqual(['12s', '9.5s', '14s']);
    rerender(<LiquidLightBackground settings={{ speed: 'invalid' }} />);
    expect(blobs()[0].style.animationDuration).toBe('24s');
    rerender(<LiquidLightBackground settings={{ speed: 'slow' }} />);
    expect(blobs()[0].style.animationDuration).toBe('38.4s');
  });
});

describe.each([
  { kind: 'halo', Component: HaloBackground },
  { kind: 'stardust', Component: StardustBackground },
])('$kind scene', ({ kind, Component }) => {
  it.each([false, true])('renders the theme palette with isLight=%s', (isLight) => {
    theme.isLight = isLight;
    const { container } = render(<Component settings={{}} />);
    const root = container.querySelector<HTMLElement>('[data-scene]');
    expect(root?.dataset.scene).toBe(`${kind}-${isLight ? 'day' : 'night'}`);
    expect(root?.getAttribute('aria-hidden')).toBe('true');
    expect(root?.classList.contains('scene-background')).toBe(true);
    // Stays inside its box: the admin preview is a 192 px card, fixed covered the whole page.
    expect(root?.style.position).toBe('');
    expect(root?.style.background).toBe(isLight ? 'transparent' : 'rgb(var(--color-dark-950))');
    const layers = [...container.querySelectorAll<HTMLElement>('[data-scene] > div')];
    expect(
      layers.every((layer) => layer.style.mixBlendMode === (isLight ? 'normal' : 'screen')),
    ).toBe(true);
    const first = layers[0];
    if (kind === 'halo') {
      expect(first.style.background).toContain(
        isLight ? 'rgb(168, 85, 247) 26%' : 'rgb(147, 51, 234) 62%',
      );
      expect(layers).toHaveLength(3);
    } else {
      expect(first.style.backgroundColor).toBe(isLight ? 'rgb(168, 85, 247)' : 'rgb(147, 51, 234)');
      expect(layers).toHaveLength(4);
    }
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('sanitizes bad colours to the default palette', () => {
    const { container, rerender } = render(<Component settings={{}} />);
    const original = container.innerHTML;
    rerender(
      <Component
        settings={{ color1: 'red; background:url(bad)', color2: 'url(bad)', color3: 'var(--bad)' }}
      />,
    );
    expect(container.innerHTML).toBe(original);
    rerender(<Component settings={{ color1: '#123456', color2: '#654321', color3: '#abcdef' }} />);
    expect(container.innerHTML).not.toBe(original);
  });

  it.each([
    { speed: 'slow', multiplier: 1.6 },
    { speed: 'normal', multiplier: 1 },
    { speed: 'fast', multiplier: 0.5 },
    { speed: 'invalid', multiplier: 1 },
  ])('scales every animation duration for $speed', ({ speed, multiplier }) => {
    const { container } = render(<Component settings={{ speed }} />);
    const animations = [...container.querySelectorAll<HTMLElement>('[data-scene] > div')]
      .flatMap((layer) => layer.style.animation.match(/\d+(?:\.\d+)?s\b/g) ?? [])
      .map(Number.parseFloat);
    const durations = kind === 'halo' ? [9, 48, 11] : [26, 32, 140, 90, 3.6];
    expect(animations).toEqual(
      durations.map((duration) => Number((duration * multiplier).toFixed(2))),
    );
  });
});

describe('StardustBackground star layers', () => {
  const shadows = (container: HTMLElement) =>
    [...container.querySelectorAll<HTMLElement>('[data-star-layer]')].map(
      (layer) => layer.style.boxShadow,
    );

  it('renders two deterministic shadow layers across mounts', () => {
    const first = render(<StardustBackground settings={{}} />);
    const original = shadows(first.container);
    expect(original).toHaveLength(2);
    for (const shadow of original) {
      expect(shadow).toContain('vw');
      expect(shadow).toContain('vh');
    }
    first.unmount();
    const second = render(<StardustBackground settings={{}} />);
    expect(shadows(second.container)).toEqual(original);
  });

  it('changes star counts at 1024px and restores the same desktop sky', () => {
    const { container } = render(<StardustBackground settings={{}} />);
    const counts = () => shadows(container).map((shadow) => shadow.match(/vw/g)?.length);
    expect(counts()).toEqual([120, 48]);
    act(() => changeMedia('(min-width: 1024px)', true));
    const desktop = shadows(container);
    expect(counts()).toEqual([270, 114]);
    act(() => changeMedia('(min-width: 1024px)', false));
    expect(counts()).toEqual([120, 48]);
    act(() => changeMedia('(min-width: 1024px)', true));
    expect(shadows(container)).toEqual(desktop);
  });

  it('uses pale and tinted stars at night and violet dust in daylight', () => {
    const { container, rerender } = render(<StardustBackground settings={{ color2: '#123456' }} />);
    const night = shadows(container);
    expect(night[0]).toContain('rgba(245,240,255,');
    expect(night[0]).toContain('color-mix(in srgb, #123456 ');
    theme.isLight = true;
    rerender(<StardustBackground settings={{ color2: '#123456' }} />);
    for (const shadow of shadows(container)) {
      expect(shadow).toContain('rgba(147,51,234,');
      expect(shadow).not.toContain('color-mix');
    }
  });
});

const staticScenes = {
  'liquid-light': LiquidLightBackground,
  halo: HaloBackground,
  stardust: StardustBackground,
};
describe.each(['seasonal', ...STATIC_SCENE_TYPES] as const)('%s static scenes', (kind) => {
  const scene = (paused = false) => {
    if (kind === 'seasonal') return <SeasonalBackground appearance="autumn-day" paused={paused} />;
    const Component = staticScenes[kind];
    return <Component settings={{}} paused={paused} />;
  };

  it('pauses and resumes the same scene when reduced motion changes', () => {
    const { container } = render(scene());
    const root = container.firstElementChild;
    const html = root?.innerHTML;
    act(() => changeMedia('(prefers-reduced-motion: reduce)', true));
    expect(root?.classList.contains('scene-paused')).toBe(true);
    expect(root?.innerHTML).toBe(html);
    act(() => changeMedia('(prefers-reduced-motion: reduce)', false));
    expect(root?.classList.contains('scene-paused')).toBe(false);
  });

  it('keeps a static scene when explicitly paused', () => {
    const { container } = render(scene(true));
    expect(container.firstElementChild?.classList.contains('scene-paused')).toBe(true);
    expect(container.firstElementChild?.getAttribute('data-paused')).toBe('true');
    expect(container.querySelector('[data-particle], .scene-blob')).not.toBeNull();
  });

  it('pauses for a hidden page and resumes without remounting', () => {
    const { container } = render(scene());
    const root = container.firstElementChild;
    const hidden = vi.spyOn(document, 'hidden', 'get');
    act(() => {
      hidden.mockReturnValue(true);
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(root?.classList.contains('scene-paused')).toBe(true);
    act(() => {
      hidden.mockReturnValue(false);
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(container.firstElementChild).toBe(root);
    expect(root?.classList.contains('scene-paused')).toBe(false);
  });

  it('pauses while Telegram is inactive', () => {
    const events = new Map<string, () => void>();
    const offEvent = vi.fn();
    vi.stubGlobal('Telegram', {
      WebApp: {
        onEvent: (name: string, callback: () => void) => events.set(name, callback),
        offEvent,
      },
    });
    const { container, unmount } = render(scene());
    const root = container.firstElementChild;
    act(() => events.get('deactivated')?.());
    expect(root?.classList.contains('scene-paused')).toBe(true);
    act(() => events.get('activated')?.());
    expect(root?.classList.contains('scene-paused')).toBe(false);
    unmount();
    expect(offEvent).toHaveBeenCalledWith('activated', expect.any(Function));
    expect(offEvent).toHaveBeenCalledWith('deactivated', expect.any(Function));
  });
});
