import { Suspense, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { brandingApi } from '@/api/branding';
import { themeColorsApi } from '@/api/themeColors';
import { DEFAULT_THEME_COLORS } from '@/types/theme';
import { useTheme } from '@/hooks/useTheme';
import type { AnimationConfig } from '@/components/ui/backgrounds/types';
import { DEFAULT_ANIMATION_CONFIG } from '@/components/ui/backgrounds/types';
import {
  backgroundComponents,
  prefetchBackground,
  prefetchSeasonalBackground,
  SeasonalBackground,
} from '@/components/ui/backgrounds/registry';
import { useReducedSceneMotion } from '@/components/ui/backgrounds/use-scene-motion';
import { isSeasonalAppearance } from '@/theme/appearance';
import { validateConfig, getCachedConfig, setCachedConfig } from '@/utils/backgroundConfig';

// The first-paint script resolves cached appearance flags/preferences before app JS runs.
const cachedAppearance =
  typeof document !== 'undefined' ? document.documentElement.dataset.appearance : undefined;
const cachedConfig = getCachedConfig();
if (cachedAppearance && isSeasonalAppearance(cachedAppearance)) {
  prefetchSeasonalBackground();
} else if (
  cachedConfig &&
  (cachedConfig.enabled || cachedConfig.type === 'liquid-light') &&
  cachedConfig.type !== 'none'
) {
  prefetchBackground(cachedConfig.type);
}

function reduceMobileSettings(settings: Record<string, unknown>): Record<string, unknown> {
  const reduced = { ...settings };
  // 75% reduction (divide by 4) instead of 50% — much less GPU work
  if (typeof reduced.particleCount === 'number')
    reduced.particleCount = Math.max(20, Math.floor(reduced.particleCount / 4));
  if (typeof reduced.particleDensity === 'number')
    reduced.particleDensity = Math.max(50, Math.floor(reduced.particleDensity / 4));
  if (typeof reduced.density === 'number')
    reduced.density = Math.max(20, Math.floor(reduced.density / 2));
  if (typeof reduced.starCount === 'number')
    reduced.starCount = Math.max(50, Math.floor(reduced.starCount / 4));
  if (typeof reduced.number === 'number')
    reduced.number = Math.max(5, Math.floor(reduced.number / 4));
  if ('interactive' in reduced) reduced.interactive = false;
  if (typeof reduced.lineCount === 'number')
    reduced.lineCount = Math.max(5, Math.floor(reduced.lineCount / 2));
  if (typeof reduced.rippleCount === 'number')
    reduced.rippleCount = Math.max(2, Math.floor(reduced.rippleCount / 2));
  if (typeof reduced.count === 'number') reduced.count = Math.max(3, Math.floor(reduced.count / 2));
  if (typeof reduced.rows === 'number') reduced.rows = Math.max(4, Math.floor(reduced.rows * 0.6));
  if (typeof reduced.cols === 'number') reduced.cols = Math.max(4, Math.floor(reduced.cols * 0.6));
  return reduced;
}

/**
 * Фон анимации — ОДНА настройка на обе темы, и оператор задаёт её под тёмную.
 * Слой лежит на весь вьюпорт под контентом, а холст заливает его непрозрачным
 * цветом каждый кадр (без этого не выходит след частиц). В светлой теме это
 * давало чёрную страницу со светлыми карточками поверх.
 *
 * Поэтому в светлой теме ground подменяется фоном страницы из брендинга: тот же
 * цвет стоит на body, так что шва не видно, и он следует за палитрой, которую
 * оператор поменяет в админке.
 *
 * Цвет приходит параметром, а не читается из getComputedStyle(document.body):
 * класс .light вешается эффектом, и чтение DOM в момент переключения темы
 * вернуло бы фон предыдущей.
 */
export function applyThemeGround(
  settings: Record<string, unknown>,
  isLight: boolean,
  lightBackground: string,
): Record<string, unknown> {
  if (!isLight) return settings;
  if (!('backgroundColor' in settings)) return settings;
  return { ...settings, backgroundColor: lightBackground };
}

function RenderBackground({ config }: { config: AnimationConfig }) {
  const prefersReducedMotion = useReducedSceneMotion();

  const { isLight, appearanceId } = useTheme();
  const seasonal = isSeasonalAppearance(appearanceId);
  const supportsStaticScene = seasonal || config.type === 'liquid-light';

  // Тот же ключ, что у ThemeColorsProvider — берём из кэша, лишнего запроса нет.
  const { data: themeColors } = useQuery({
    queryKey: ['theme-colors'],
    queryFn: themeColorsApi.getColors,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const settings = useMemo(() => {
    const isMobile = window.innerWidth < 768;
    const base =
      config.reducedOnMobile && isMobile ? reduceMobileSettings(config.settings) : config.settings;

    return applyThemeGround(base, isLight, (themeColors ?? DEFAULT_THEME_COLORS).lightBackground);
  }, [config.reducedOnMobile, config.settings, isLight, themeColors]);

  if (!supportsStaticScene && (!config.enabled || config.type === 'none' || prefersReducedMotion)) {
    return null;
  }

  const Component = config.type !== 'none' ? backgroundComponents[config.type] : undefined;

  if (!seasonal && !Component) return null;

  const isMobile = window.innerWidth < 768;

  // On mobile, cap blur to 4px max — full blur is extremely GPU-heavy
  const effectiveBlur = seasonal ? 0 : isMobile ? Math.min(config.blur, 4) : config.blur;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0"
      style={{
        zIndex: -2,
        opacity: seasonal ? 1 : config.opacity,
        filter: effectiveBlur > 0 ? `blur(${effectiveBlur}px)` : undefined,
        contain: 'strict',
        backfaceVisibility: 'hidden',
      }}
    >
      <Suspense fallback={null}>
        {seasonal ? (
          <SeasonalBackground
            appearance={appearanceId}
            paused={!config.enabled || config.type === 'none'}
          />
        ) : Component ? (
          <Component settings={settings} paused={!config.enabled} />
        ) : null}
      </Suspense>
    </div>,
    document.body,
  );
}

export function BackgroundRenderer() {
  const { data: config } = useQuery({
    queryKey: ['animation-config'],
    queryFn: async () => {
      const raw = await brandingApi.getAnimationConfig();
      const result = validateConfig(raw) ?? DEFAULT_ANIMATION_CONFIG;
      setCachedConfig(result);
      return result;
    },
    initialData: getCachedConfig() ?? undefined,
    initialDataUpdatedAt: 0,
    staleTime: 30_000,
  });

  const effectiveConfig = config ?? DEFAULT_ANIMATION_CONFIG;
  return <RenderBackground config={effectiveConfig} />;
}

export function StaticBackgroundRenderer({ config }: { config: AnimationConfig }) {
  const validated = useMemo(() => validateConfig(config), [config]);
  if (!validated) return null;
  return <RenderBackground config={validated} />;
}
