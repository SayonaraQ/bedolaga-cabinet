import type {
  AnimationConfig,
  BackgroundType,
  LightAnimationOverride,
} from '@/components/ui/backgrounds/types';

const ANIMATION_CACHE_KEY = 'cabinet_animation_config';
const MAX_CONFIG_JSON_LENGTH = 10_000;

const VALID_TYPES: ReadonlySet<string> = new Set<BackgroundType>([
  'aurora',
  'sparkles',
  'vortex',
  'shooting-stars',
  'background-beams',
  'background-beams-collision',
  'gradient-animation',
  'wavy',
  'background-lines',
  'boxes',
  'meteors',
  'grid',
  'dots',
  'spotlight',
  'ripple',
  'fireflies',
  'snowfall',
  'starfield',
  'matrix-rain',
  'liquid-gradient',
  'liquid-light',
  'halo',
  'stardust',
  'constellation',
  'none',
]);

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Фон светлой темы. Ошибка в нём не должна выбрасывать весь конфиг (тогда
 * пропал бы и основной фон), поэтому мусор превращается в «как в тёмной».
 */
function validateLight(value: unknown): LightAnimationOverride | undefined {
  if (value == null) return undefined;
  if (!isPlainObject(value)) return undefined;
  if (value.inherit !== false) return { ...INHERIT_LIGHT, ...pickLightFields(value) };
  if (typeof value.type !== 'string' || !VALID_TYPES.has(value.type)) return undefined;
  return {
    inherit: false,
    type: value.type as BackgroundType,
    settings: isPlainObject(value.settings) ? value.settings : {},
    opacity: typeof value.opacity === 'number' ? clamp(value.opacity, 0, 1) : 1,
    blur: typeof value.blur === 'number' ? clamp(value.blur, 0, 50) : 0,
  };
}

const INHERIT_LIGHT: LightAnimationOverride = {
  inherit: true,
  type: 'aurora',
  settings: {},
  opacity: 1,
  blur: 0,
};

// Поля светлого фона сохраняются и при inherit: админка показывает последний
// выбранный эффект, когда наследование снова выключают.
function pickLightFields(value: Record<string, unknown>): Partial<LightAnimationOverride> {
  const out: Partial<LightAnimationOverride> = {};
  if (typeof value.type === 'string' && VALID_TYPES.has(value.type)) {
    out.type = value.type as BackgroundType;
  }
  if (isPlainObject(value.settings)) out.settings = value.settings;
  if (typeof value.opacity === 'number') out.opacity = clamp(value.opacity, 0, 1);
  if (typeof value.blur === 'number') out.blur = clamp(value.blur, 0, 50);
  return out;
}

export function validateConfig(parsed: unknown): AnimationConfig | null {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.enabled !== 'boolean') return null;
  if (typeof obj.type !== 'string' || !VALID_TYPES.has(obj.type)) return null;
  if (typeof obj.opacity !== 'number') return null;
  if (typeof obj.blur !== 'number') return null;
  if (obj.settings != null && (typeof obj.settings !== 'object' || Array.isArray(obj.settings)))
    return null;
  const light = validateLight(obj.light);
  return {
    enabled: obj.enabled,
    type: obj.type as BackgroundType,
    opacity: Math.max(0, Math.min(1, obj.opacity)),
    blur: Math.max(0, Math.min(50, obj.blur)),
    settings: (obj.settings as Record<string, unknown>) ?? {},
    reducedOnMobile: typeof obj.reducedOnMobile === 'boolean' ? obj.reducedOnMobile : true,
    ...(light ? { light } : {}),
  };
}

export function getCachedConfig(): AnimationConfig | null {
  try {
    const cached = localStorage.getItem(ANIMATION_CACHE_KEY);
    if (!cached || cached.length > MAX_CONFIG_JSON_LENGTH) return null;
    return validateConfig(JSON.parse(cached));
  } catch {
    return null;
  }
}

export function setCachedConfig(config: AnimationConfig) {
  try {
    localStorage.setItem(ANIMATION_CACHE_KEY, JSON.stringify(config));
  } catch {}
}

export function setCachedAnimationConfig(config: AnimationConfig) {
  const validated = validateConfig(config);
  if (validated) setCachedConfig(validated);
}
