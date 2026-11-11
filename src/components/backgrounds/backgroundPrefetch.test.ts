// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DEFAULT_ANIMATION_CONFIG, STATIC_SCENE_TYPES } from '@/components/ui/backgrounds/types';
import { setCachedConfig } from '@/utils/backgroundConfig';

const prefetch = vi.hoisted(() => ({ background: vi.fn(), seasonal: vi.fn() }));
vi.mock('@/components/ui/backgrounds/registry', () => ({
  backgroundComponents: {},
  SeasonalBackground: () => null,
  prefetchBackground: prefetch.background,
  prefetchSeasonalBackground: prefetch.seasonal,
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  localStorage.clear();
  delete document.documentElement.dataset.appearance;
});
afterEach(() => {
  delete document.documentElement.dataset.appearance;
  localStorage.clear();
});

it('prefetches the cached active seasonal appearance before rendering, even with a disabled config', async () => {
  document.documentElement.dataset.appearance = 'winter-night';
  setCachedConfig({ ...DEFAULT_ANIMATION_CONFIG, type: 'vortex', enabled: false });
  await import('./BackgroundRenderer');
  expect(prefetch.seasonal).toHaveBeenCalledOnce();
  expect(prefetch.background).not.toHaveBeenCalled();
});

it.each(STATIC_SCENE_TYPES.flatMap((type) => [true, false].map((enabled) => ({ type, enabled }))))(
  'prefetches cached $type with enabled=$enabled for a base appearance',
  async ({ type, enabled }) => {
    document.documentElement.dataset.appearance = 'dark';
    setCachedConfig({ ...DEFAULT_ANIMATION_CONFIG, type, enabled });
    await import('./BackgroundRenderer');
    expect(prefetch.background).toHaveBeenCalledWith(type);
    expect(prefetch.seasonal).not.toHaveBeenCalled();
  },
);

it('ignores a stale seasonal hint when the first-paint appearance is base', async () => {
  document.documentElement.dataset.appearance = 'light';
  localStorage.setItem('cabinet-seasonal-hint', JSON.stringify({ id: 'winter-night', vars: {} }));
  await import('./BackgroundRenderer');
  expect(prefetch.seasonal).not.toHaveBeenCalled();
});
