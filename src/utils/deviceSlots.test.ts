import { describe, expect, it } from 'vitest';
import {
  appLabel,
  deviceKind,
  findMultiAppDevices,
  slotDeviceNames,
  slotGridColumns,
} from './deviceSlots';

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

  // Приложения пишут модель по-разному: INCY — «Xiaomi 25102PCBEG», Happ —
  // «25102PCBEG». Пары взяты из панели 04.11.2026 (один юзер, одна платформа).
  it.each([
    ['Xiaomi 25102PCBEG', '25102PCBEG', 'Xiaomi 25102PCBEG'],
    ['HONOR BRP-NX1', 'BRP-NX1', 'HONOR BRP-NX1'],
    ['samsung SM-A556E', 'SM-A556E', 'samsung SM-A556E'],
    ['xiaomi Redmi Note 6 Pro', 'Redmi Note 6 Pro', 'xiaomi Redmi Note 6 Pro'],
    ['Xiaomi M2102J20SG', 'POCO M2102J20SG', 'Xiaomi M2102J20SG'],
    ['TECNO TECNO BG7n', 'TECNO BG7n', 'TECNO BG7n'],
    ['INFINIX Infinix X6856', 'Infinix Infinix X6856', 'INFINIX X6856'],
  ])('treats «%s» and «%s» as one phone named «%s»', (first, second, name) => {
    const groups = findMultiAppDevices([
      dev('a', 'Android', first, 'INCY'),
      dev('b', 'Android', second, 'Happ'),
    ]);
    expect(groups).toEqual([{ model: name, hwids: ['a', 'b'], apps: ['INCY', 'Happ'] }]);
  });

  it('does not glue a bare «iPhone» to a concrete model: may be two phones', () => {
    expect(
      findMultiAppDevices([
        dev('a', 'iOS', 'iPhone', 'Happ'),
        dev('b', 'iOS', 'iPhone 17 Pro', 'INCY'),
      ]),
    ).toEqual([]);
  });

  it('does not glue computers: «Windows 11 Pro» is the OS, not the machine', () => {
    expect(
      findMultiAppDevices([
        dev('a', 'Windows', 'Windows 11 Pro', 'koala-clash'),
        dev('b', 'Windows', 'Windows 11 Pro', 'Happ'),
      ]),
    ).toEqual([]);
  });
});

describe('slotDeviceNames', () => {
  it('gives both slots of one phone the same, fullest name', () => {
    const names = slotDeviceNames([
      dev('a', 'Android', 'Xiaomi 25102PCBEG', 'INCY'),
      dev('b', 'Android', '25102PCBEG', 'Happ'),
      dev('c', 'iOS', 'iPhone 15', 'Happ'),
    ]);
    expect(names.get('a')).toBe('Xiaomi 25102PCBEG');
    expect(names.get('b')).toBe('Xiaomi 25102PCBEG');
    expect(names.get('c')).toBe('iPhone 15');
  });

  it('drops a doubled brand and keeps the user alias first', () => {
    const names = slotDeviceNames([
      dev('a', 'Android', 'TECNO TECNO KJ6', 'Happ'),
      { ...dev('b', 'Android', 'SM-A556E', 'INCY'), local_name: 'Мамин телефон' },
    ]);
    expect(names.get('a')).toBe('TECNO KJ6');
    expect(names.get('b')).toBe('Мамин телефон');
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

// Бот отдаёт `device_name` по справочнику Google Play: «25102PCBEG» → «POCO F8 Ultra».
describe('marketing names from the bot', () => {
  const named = (hwid: string, model: string, app: string, device_name: string | null) => ({
    ...dev(hwid, 'Android', model, app),
    device_name,
  });

  it('shows the marketing name on every slot of the phone and in the warning', () => {
    const devices = [
      named('a', 'Xiaomi 25102PCBEG', 'INCY', 'POCO F8 Ultra'),
      named('b', '25102PCBEG', 'Happ', 'POCO F8 Ultra'),
    ];
    const names = slotDeviceNames(devices);
    expect(names.get('a')).toBe('POCO F8 Ultra');
    expect(names.get('b')).toBe('POCO F8 Ultra');
    expect(findMultiAppDevices(devices)[0].model).toBe('POCO F8 Ultra');
  });

  it('borrows the name from a sibling record of the same phone', () => {
    const names = slotDeviceNames([
      named('a', 'Xiaomi 25102PCBEG', 'INCY', 'POCO F8 Ultra'),
      named('b', '25102PCBEG', 'Happ', null),
    ]);
    expect(names.get('b')).toBe('POCO F8 Ultra');
  });

  it('keeps the user alias above the marketing name', () => {
    const names = slotDeviceNames([
      { ...named('a', '25102PCBEG', 'Happ', 'POCO F8 Ultra'), local_name: 'Рабочий' },
    ]);
    expect(names.get('a')).toBe('Рабочий');
  });
});
