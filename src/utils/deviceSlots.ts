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

/** Имя, под которым человек узнаёт устройство: свой псевдоним → модель → платформа. */
export function deviceName(device: SlotDevice): string {
  const model = device.device_model?.trim();
  return (
    device.local_name?.trim() || (model && model !== 'Unknown' ? model : '') || device.platform
  );
}

export interface MultiAppDevice {
  model: string;
  hwids: string[];
  apps: string[];
}

/**
 * Одно физическое устройство в нескольких приложениях.
 *
 * Признак — одна платформа и модель при разных приложениях. Одинаковое
 * приложение дважды не считаем: это могут быть два одинаковых телефона.
 * Без модели («Unknown») не склеиваем — совпадение ничего не значит.
 */
export function findMultiAppDevices(devices: SlotDevice[]): MultiAppDevice[] {
  const groups = new Map<string, SlotDevice[]>();
  for (const device of devices) {
    const model = device.device_model?.trim();
    if (!model || model === 'Unknown') continue;
    const key = `${device.platform}\u0000${model}`;
    groups.set(key, [...(groups.get(key) ?? []), device]);
  }
  const result: MultiAppDevice[] = [];
  for (const group of groups.values()) {
    const apps = [...new Set(group.map((d) => appLabel(d.app)).filter((a): a is string => !!a))];
    if (group.length < 2 || apps.length < 2) continue;
    result.push({ model: group[0].device_model.trim(), hwids: group.map((d) => d.hwid), apps });
  }
  return result;
}

/** До трёх слотов — в один ряд, дальше по четыре: десять слотов — три ряда, не пять. */
export function slotGridColumns(slots: number): number {
  return Math.max(1, Math.min(slots, 4));
}
