// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockSceneMedia } from '@/test/sceneMedia';
import { SEASONAL_PALETTES, type SeasonalAppearanceId } from '@/theme/appearance';
import LiquidLightBackground from './liquid-light';
import SeasonalBackground from './seasonal';

const theme = vi.hoisted(() => ({ isLight: false }));
vi.mock('@/hooks/useTheme', () => ({ useTheme: () => theme }));

let changeMedia: ReturnType<typeof mockSceneMedia>;
beforeEach(() => {
  theme.isLight = false;
  vi.stubGlobal('innerWidth', 1024);
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  changeMedia = mockSceneMedia();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const appearances = Object.keys(SEASONAL_PALETTES) as SeasonalAppearanceId[];
describe('SeasonalBackground', () => {
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

describe.each(['seasonal', 'liquid-light'] as const)('%s static scenes', (kind) => {
  const scene = (paused = false) =>
    kind === 'seasonal' ? (
      <SeasonalBackground appearance="autumn-day" paused={paused} />
    ) : (
      <LiquidLightBackground settings={{}} paused={paused} />
    );

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
