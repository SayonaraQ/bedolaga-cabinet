import { describe, expect, it } from 'vitest';
import { appLabel, deviceKind, findMultiAppDevices, slotGridColumns } from './deviceSlots';

const dev = (hwid: string, platform: string, device_model: string, app: string | null) => ({
  hwid,
  platform,
  device_model,
  app,
  created_at: null,
});

describe('appLabel', () => {
  it.each([
    ['Happ', 'Happ'],
    ['INCY', 'INCY'],
    ['v2raytun', 'v2RayTun'],
    ['koala-clash', 'Koala Clash'],
    ['FlClash X', 'FlClash X'],
    ['SomeNewClient', 'SomeNewClient'],
  ])('%s → %s', (raw, label) => {
    expect(appLabel(raw)).toBe(label);
  });

  it('returns null when the panel does not know the client', () => {
    expect(appLabel(null)).toBeNull();
    expect(appLabel('')).toBeNull();
  });
});

describe('deviceKind', () => {
  it.each([
    ['iOS', 'phone'],
    ['Android', 'phone'],
    ['iPadOS', 'tablet'],
    ['AndroidTV', 'tv'],
    ['Windows', 'pc'],
    ['Windows 11', 'pc'],
    ['macOS', 'pc'],
    ['Linux', 'pc'],
    ['Unknown', 'phone'],
  ])('%s → %s', (platform, kind) => {
    expect(deviceKind(platform)).toBe(kind);
  });
});

describe('findMultiAppDevices', () => {
  it('finds one phone added to two apps', () => {
    const groups = findMultiAppDevices([
      dev('a', 'Android', 'Xiaomi 14', 'INCY'),
      dev('b', 'Android', 'Xiaomi 14', 'Happ'),
      dev('c', 'iOS', 'iPhone 15', 'Happ'),
    ]);
    expect(groups).toEqual([{ model: 'Xiaomi 14', hwids: ['a', 'b'], apps: ['INCY', 'Happ'] }]);
  });

  it('does not flag the same app twice: that may be two identical phones', () => {
    expect(
      findMultiAppDevices([
        dev('a', 'iOS', 'iPhone 15', 'Happ'),
        dev('b', 'iOS', 'iPhone 15', 'Happ'),
      ]),
    ).toEqual([]);
  });

  it('ignores devices without a real model name', () => {
    expect(
      findMultiAppDevices([
        dev('a', 'Windows', 'Unknown', 'Happ'),
        dev('b', 'Windows', 'Unknown', 'INCY'),
      ]),
    ).toEqual([]);
  });
});

describe('slotGridColumns', () => {
  it.each([
    [2, 2],
    [3, 3],
    [4, 4],
    [7, 4],
    [10, 4],
  ])('%i slots → %i columns', (slots, cols) => {
    expect(slotGridColumns(slots)).toBe(cols);
  });
});
