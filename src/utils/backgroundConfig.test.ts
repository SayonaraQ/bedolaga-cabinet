import { describe, expect, it } from 'vitest';
import { DEFAULT_ANIMATION_CONFIG } from '@/components/ui/backgrounds/types';
import { validateConfig } from './backgroundConfig';

describe('backgroundConfig', () => {
  it('accepts liquid-light with its settings, including when animation is disabled', () => {
    for (const enabled of [true, false]) {
      const config = {
        ...DEFAULT_ANIMATION_CONFIG,
        enabled,
        type: 'liquid-light',
        settings: { color1: '#9333EA', speed: 'slow' },
      };
      expect(validateConfig(config)).toEqual(config);
    }
  });

  it('keeps rejecting unknown background types', () => {
    expect(validateConfig({ ...DEFAULT_ANIMATION_CONFIG, type: 'seasonal' })).toBeNull();
  });
});
