import { describe, expect, it } from 'vitest';
import { buildStarShadow } from './stardust';

const options = {
  seed: 42,
  minR: 0.2,
  maxR: 0.7,
  minA: 0.35,
  maxA: 0.8,
  colour: () => '#ffffff',
};

describe('buildStarShadow', () => {
  it.each([0, 1, 60, 135])('emits two shadows for each of %s stars', (count) => {
    const shadow = buildStarShadow({ ...options, count });
    expect(shadow ? shadow.split(', ') : []).toHaveLength(count * 2);
  });

  it('keeps the same sky for the same seed and varies it for another seed', () => {
    const shadow = buildStarShadow({ ...options, count: 10 });
    expect(buildStarShadow({ ...options, count: 10 })).toBe(shadow);
    expect(buildStarShadow({ ...options, count: 10, seed: 43 })).not.toBe(shadow);
  });

  it('repeats each star exactly one viewport below with the same radius and colour', () => {
    const shadows = buildStarShadow({ ...options, count: 20 }).split(', ');
    for (let i = 0; i < shadows.length; i += 2) {
      const [x, y, blur, radius, color] = shadows[i].split(' ');
      const [nextX, nextY, nextBlur, nextRadius, nextColor] = shadows[i + 1].split(' ');
      expect(Number.parseFloat(x)).toBeGreaterThanOrEqual(0);
      expect(Number.parseFloat(x)).toBeLessThan(100);
      expect(Number.parseFloat(y)).toBeGreaterThanOrEqual(0);
      expect(Number.parseFloat(y)).toBeLessThan(100);
      expect(Number.parseFloat(radius)).toBeGreaterThanOrEqual(options.minR);
      expect(Number.parseFloat(radius)).toBeLessThanOrEqual(options.maxR);
      expect(Number.parseFloat(nextY) - Number.parseFloat(y)).toBeCloseTo(100);
      expect([nextX, nextBlur, nextRadius, nextColor]).toEqual([x, blur, radius, color]);
    }
  });
});
