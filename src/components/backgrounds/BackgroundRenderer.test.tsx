// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_ANIMATION_CONFIG,
  STATIC_SCENE_TYPES,
  type AnimationConfig,
} from '@/components/ui/backgrounds/types';
import type { AppearanceId } from '@/theme/appearance';
import { DEFAULT_THEME_COLORS } from '@/types/theme';
import { mockSceneMedia } from '@/test/sceneMedia';
import { BackgroundRenderer } from './BackgroundRenderer';
import { BackgroundHost, useBackgroundConsumer } from './BackgroundHost';

const theme = vi.hoisted(() => ({ isLight: false, appearanceId: 'dark' as AppearanceId }));
vi.mock('@/hooks/useTheme', () => ({ useTheme: () => theme }));
vi.mock('@/api/branding', () => ({ brandingApi: { getAnimationConfig: vi.fn() } }));
vi.mock('@/components/ui/backgrounds/vortex', () => ({
  default: () => <div data-scene="vortex" />,
}));

let changeMedia: ReturnType<typeof mockSceneMedia>;
const clients: QueryClient[] = [];
beforeEach(() => {
  theme.isLight = false;
  theme.appearanceId = 'dark';
  localStorage.clear();
  vi.stubGlobal('innerWidth', 1024);
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  changeMedia = mockSceneMedia();
});
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function prepare(config: Partial<AnimationConfig> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  client.setQueryData(['animation-config'], {
    ...DEFAULT_ANIMATION_CONFIG,
    type: 'vortex',
    ...config,
  });
  client.setQueryData(['theme-colors'], DEFAULT_THEME_COLORS);
  return client;
}

function renderBackground(config: Partial<AnimationConfig> = {}) {
  const client = prepare(config);
  return render(
    <QueryClientProvider client={client}>
      <BackgroundRenderer />
    </QueryClientProvider>,
  );
}

describe('BackgroundRenderer appearance selection', () => {
  it.each([
    { type: 'vortex', enabled: true },
    { type: 'vortex', enabled: false },
    { type: 'none', enabled: false },
    { type: 'none', enabled: true },
  ] as const)('renders seasonal appearance over admin config %j', async (config) => {
    theme.appearanceId = 'winter-night';
    renderBackground({ ...config, opacity: 0, blur: 50 });
    await waitFor(() =>
      expect(document.querySelector('[data-scene="winter-night"]')).not.toBeNull(),
    );
    const scene = document.querySelector('[data-scene="winter-night"]');
    expect(document.querySelector('[data-scene="vortex"]')).toBeNull();
    expect(scene?.classList.contains('scene-paused')).toBe(
      !config.enabled || config.type === 'none',
    );
    const portal = scene?.parentElement as HTMLElement;
    expect(portal.style.opacity).toBe('1');
    expect(portal.style.filter).toBe('');
  });

  it.each(['dark', 'light'] as const)(
    'honours the admin background for base appearance %s',
    async (appearance) => {
      theme.appearanceId = appearance;
      theme.isLight = appearance === 'light';
      renderBackground();
      await waitFor(() => expect(document.querySelector('[data-scene="vortex"]')).not.toBeNull());
      expect(document.querySelectorAll('[data-scene]')).toHaveLength(1);
    },
  );

  it.each([{ enabled: false }, { type: 'none' as const }])(
    'honours disabled base background %j',
    (config) => {
      renderBackground(config);
      expect(document.querySelector('[data-scene]')).toBeNull();
    },
  );

  it('changes appearance within the same portal', async () => {
    const client = prepare();
    const element = () => (
      <QueryClientProvider client={client}>
        <BackgroundRenderer />
      </QueryClientProvider>
    );
    const { rerender } = render(element());
    await waitFor(() => expect(document.querySelector('[data-scene="vortex"]')).not.toBeNull());
    const portal = document.querySelector('[data-scene]')?.parentElement;
    theme.appearanceId = 'summer-day';
    theme.isLight = true;
    rerender(element());
    await waitFor(() => expect(document.querySelector('[data-scene="summer-day"]')).not.toBeNull());
    expect(document.querySelector('[data-scene]')?.parentElement).toBe(portal);
    theme.appearanceId = 'light';
    rerender(element());
    await waitFor(() => expect(document.querySelector('[data-scene="vortex"]')).not.toBeNull());
  });
});

describe('BackgroundRenderer static scenes', () => {
  it.each(['seasonal', ...STATIC_SCENE_TYPES] as const)(
    'keeps %s rendered and paused under reduced motion',
    async (kind) => {
      if (kind === 'seasonal') theme.appearanceId = 'spring-night';
      window.matchMedia('(prefers-reduced-motion: reduce)');
      changeMedia('(prefers-reduced-motion: reduce)', true);
      renderBackground({ type: kind === 'seasonal' ? 'vortex' : kind });
      await waitFor(() => expect(document.querySelector('.scene-paused')).not.toBeNull());
      const scene = document.querySelector('[data-scene]');
      act(() => changeMedia('(prefers-reduced-motion: reduce)', false));
      expect(document.querySelector('[data-scene]')).toBe(scene);
      expect(scene?.classList.contains('scene-paused')).toBe(false);
    },
  );

  it.each(STATIC_SCENE_TYPES)('keeps disabled %s visible as a static scene', async (type) => {
    renderBackground({ type, enabled: false });
    await waitFor(() =>
      expect(document.querySelector(`[data-scene="${type}-night"]`)).not.toBeNull(),
    );
    expect(document.querySelector('.scene-paused')).not.toBeNull();
  });

  it('keeps the existing null result for vortex under reduced motion', () => {
    window.matchMedia('(prefers-reduced-motion: reduce)');
    changeMedia('(prefers-reduced-motion: reduce)', true);
    renderBackground();
    expect(document.querySelector('[data-scene]')).toBeNull();
  });
});

it('keeps one seasonal scene mounted across navigation between background consumers', async () => {
  theme.appearanceId = 'autumn-night';
  const client = prepare();
  function Route() {
    useBackgroundConsumer();
    return null;
  }
  const element = (route: string) => (
    <QueryClientProvider client={client}>
      <BackgroundHost />
      <Route key={route} />
    </QueryClientProvider>
  );
  const { rerender } = render(element('/'));
  await waitFor(() => expect(document.querySelector('[data-scene="autumn-night"]')).not.toBeNull());
  const scene = document.querySelector('[data-scene]');
  const particle = scene?.querySelector('[data-particle]');
  rerender(element('/subscription'));
  expect(document.querySelectorAll('[data-scene]')).toHaveLength(1);
  expect(document.querySelector('[data-scene]')).toBe(scene);
  expect(scene?.querySelector('[data-particle]')).toBe(particle);
});
