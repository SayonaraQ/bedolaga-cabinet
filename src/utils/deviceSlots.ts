/**
 * Логика слотов устройств на главной.
 *
 * Слот = приложение с подпиской на устройстве: каждое приложение заводит свой
 * HWID, поэтому один телефон с подпиской и в INCY, и в Happ занимает два слота.
 * Бот отдаёт у устройства `app` — сырой первый токен User-Agent клиента.
 */

export type DeviceKind = 'phone' | 'tablet' | 'pc' | 'tv';

export interface SlotDevice {
  hwid: string;
  platform: string;
  device_model: string;
  created_at: string | null;
  local_name?: string | null;
  app?: string | null;
}

// Сырые токены User-Agent → имя, как его пишет само приложение. На 04.11.2026
// в панели: Happ, INCY, v2raytun, koala-clash; остальные единичные.
const APP_LABELS: Record<string, string> = {
  happ: 'Happ',
  incy: 'INCY',
  v2raytun: 'v2RayTun',
  'koala-clash': 'Koala Clash',
  flclash: 'FlClash',
  'flclash x': 'FlClash X',
  throne: 'Throne',
  karing: 'Karing',
  shadowrocket: 'Shadowrocket',
  'sing-box': 'sing-box',
  streisand: 'Streisand',
  hiddify: 'Hiddify',
  'clash-verge': 'Clash Verge',
  v2box: 'V2Box',
  nekobox: 'NekoBox',
};

export function appLabel(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  return APP_LABELS[value.toLowerCase()] ?? value;
}

export function deviceKind(platform: string): DeviceKind {
  const p = platform.toLowerCase();
  if (p.includes('ipad')) return 'tablet';
  if (p.includes('tv')) return 'tv';
  if (p.includes('windows') || p.includes('mac') || p.includes('linux')) return 'pc';
  return 'phone';
}

const hasModel = (device: SlotDevice): boolean => {
  const model = device.device_model?.trim();
  return !!model && model !== 'Unknown';
};

/** «TECNO TECNO BG7n» → «TECNO BG7n»: часть клиентов пишет бренд дважды. */
export function cleanModel(raw: string): string {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  if (tokens.length >= 2 && tokens[0].toLowerCase() === tokens[1].toLowerCase()) {
    tokens.splice(1, 1);
  }
  return tokens.join(' ');
}

const tokensOf = (name: string): string[] => name.toLowerCase().split(/\s+/).filter(Boolean);
const isModelCode = (token: string): boolean =>
  token.length >= 4 && /\d/.test(token) && /[a-z]/.test(token);

/**
 * Одна ли это модель в записи разных приложений.
 *
 * INCY пишет «Xiaomi 25102PCBEG», Happ — «25102PCBEG», v2RayTun — «POCO
 * M2102J20SG» там, где INCY пишет «Xiaomi M2102J20SG». Поэтому совпадение —
 * это (1) равенство, (2) одно имя целиком в хвосте другого, если в нём есть
 * цифры (голое «iPhone» к «iPhone 17 Pro» не клеим: телефонов может быть два),
 * или (3) общий последний токен-код модели вида «буквы+цифры».
 */
function sameModel(a: string, b: string): boolean {
  const ta = tokensOf(cleanModel(a));
  const tb = tokensOf(cleanModel(b));
  if (ta.join(' ') === tb.join(' ')) return true;
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const tail = long.slice(long.length - short.length);
  if (short.length > 0 && tail.join(' ') === short.join(' ') && short.some((t) => /\d/.test(t))) {
    return true;
  }
  const lastA = ta[ta.length - 1];
  return !!lastA && lastA === tb[tb.length - 1] && isModelCode(lastA);
}

interface PhysicalDevice {
  name: string;
  members: SlotDevice[];
}

/**
 * Склейка HWID в физические устройства. Компьютеры не клеим: у них в модели
 * версия системы («Windows 11 Pro»), а не машина, и совпадение ничего не значит.
 */
function physicalDevices(devices: SlotDevice[]): PhysicalDevice[] {
  const groups: SlotDevice[][] = [];
  for (const device of devices) {
    if (!hasModel(device) || deviceKind(device.platform) === 'pc') continue;
    const platform = device.platform.toLowerCase();
    const group = groups.find(
      (g) =>
        g[0].platform.toLowerCase() === platform &&
        g.some((m) => sameModel(m.device_model, device.device_model)),
    );
    if (group) group.push(device);
    else groups.push([device]);
  }
  return groups.map((members) => {
    // Самое полное имя из записей группы: «Xiaomi 25102PCBEG», а не «25102PCBEG».
    const names = members.map((m) => cleanModel(m.device_model));
    const name = names.reduce((best, n) => (tokensOf(n).length > tokensOf(best).length ? n : best));
    return { name, members };
  });
}

/** Имя, под которым человек узнаёт устройство: свой псевдоним → модель → платформа. */
export function deviceName(device: SlotDevice): string {
  return (
    device.local_name?.trim() ||
    (hasModel(device) ? cleanModel(device.device_model) : '') ||
    device.platform
  );
}

/**
 * Имена для ячеек: у всех HWID одного телефона — одно и то же, самое полное.
 * Иначе одна ячейка «Xiaomi 25102PCBEG», соседняя «25102PCBEG», и человек не
 * видит, что это один телефон. Свой псевдоним пользователя — главнее.
 */
export function slotDeviceNames(devices: SlotDevice[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const device of devices) names.set(device.hwid, deviceName(device));
  for (const group of physicalDevices(devices)) {
    for (const member of group.members) {
      if (!member.local_name?.trim()) names.set(member.hwid, group.name);
    }
  }
  return names;
}

export interface MultiAppDevice {
  model: string;
  hwids: string[];
  apps: string[];
}

/**
 * Одно физическое устройство в нескольких приложениях.
 *
 * Одинаковое приложение дважды не считаем: это могут быть два одинаковых
 * телефона. Без модели («Unknown») и компьютеры не склеиваем.
 */
export function findMultiAppDevices(devices: SlotDevice[]): MultiAppDevice[] {
  const result: MultiAppDevice[] = [];
  for (const group of physicalDevices(devices)) {
    const apps = [
      ...new Set(group.members.map((d) => appLabel(d.app)).filter((a): a is string => !!a)),
    ];
    if (group.members.length < 2 || apps.length < 2) continue;
    result.push({ model: group.name, hwids: group.members.map((d) => d.hwid), apps });
  }
  return result;
}

/** До трёх слотов — в один ряд, дальше по четыре: десять слотов — три ряда, не пять. */
export function slotGridColumns(slots: number): number {
  return Math.max(1, Math.min(slots, 4));
}
