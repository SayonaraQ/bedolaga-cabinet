import { describe, expect, it } from 'vitest';
import { DEFAULT_ANIMATION_CONFIG, STATIC_SCENE_TYPES } from '@/components/ui/backgrounds/types';
import { validateConfig } from './backgroundConfig';

describe('backgroundConfig', () => {
  it.each(STATIC_SCENE_TYPES)(
    'accepts %s with its settings, including when animation is disabled',
    (type) => {
      for (const enabled of [true, false]) {
        const config = {
          ...DEFAULT_ANIMATION_CONFIG,
          enabled,
          type,
          settings: { color1: '#9333EA', speed: 'slow' },
        };
        expect(validateConfig(config)).toEqual(config);
      }
    },
  );

  it('keeps rejecting unknown background types', () => {
    expect(validateConfig({ ...DEFAULT_ANIMATION_CONFIG, type: 'seasonal' })).toBeNull();
  });
});

describe('light-theme override', () => {
  const base = { enabled: true, type: 'stardust', opacity: 1, blur: 0, settings: {} };

  it('keeps a valid custom override', () => {
    const light = {
      inherit: false,
      type: 'halo',
      settings: { speed: 'slow' },
      opacity: 0.7,
      blur: 3,
    };
    expect(validateConfig({ ...base, light })?.light).toEqual(light);
  });

  it('turns a junk override into nothing instead of dropping the config', () => {
    const config = validateConfig({ ...base, light: 'x' });
    expect(config?.type).toBe('stardust');
    expect(config?.light).toBeUndefined();
  });

  it('drops a custom override with an unknown type', () => {
    expect(
      validateConfig({ ...base, light: { inherit: false, type: 'nope' } })?.light,
    ).toBeUndefined();
  });

  it('clamps opacity and blur of the override', () => {
    const light = validateConfig({
      ...base,
      light: { inherit: false, type: 'halo', opacity: 5, blur: 500, settings: [] },
    })?.light;
    expect(light).toEqual({ inherit: false, type: 'halo', settings: {}, opacity: 1, blur: 50 });
  });

  it('still accepts configs without the override', () => {
    expect(validateConfig(base)?.light).toBeUndefined();
  });
});
