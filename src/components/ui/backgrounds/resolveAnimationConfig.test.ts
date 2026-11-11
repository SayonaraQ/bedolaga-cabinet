import { describe, expect, it } from 'vitest';
import { DEFAULT_ANIMATION_CONFIG, resolveAnimationConfig, type AnimationConfig } from './types';

const main: AnimationConfig = { ...DEFAULT_ANIMATION_CONFIG, type: 'stardust', opacity: 0.9 };
const light = {
  inherit: false,
  type: 'halo' as const,
  settings: { speed: 'slow' },
  opacity: 0.6,
  blur: 2,
};

describe('resolveAnimationConfig', () => {
  it('returns the main config without a light override', () => {
    expect(resolveAnimationConfig(main, true)).toBe(main);
  });

  it('returns the main config while the override inherits', () => {
    expect(resolveAnimationConfig({ ...main, light: { ...light, inherit: true } }, true).type).toBe(
      'stardust',
    );
  });

  it('takes the effect fields from the override in the light theme', () => {
    const resolved = resolveAnimationConfig({ ...main, light }, true);
    expect(resolved).toMatchObject({
      type: 'halo',
      settings: { speed: 'slow' },
      opacity: 0.6,
      blur: 2,
      enabled: main.enabled,
      reducedOnMobile: main.reducedOnMobile,
    });
  });

  it('ignores the override in the dark theme', () => {
    expect(resolveAnimationConfig({ ...main, light }, false).type).toBe('stardust');
  });
});
