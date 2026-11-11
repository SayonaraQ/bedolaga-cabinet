import { Suspense } from 'react';
import { backgroundComponents } from '@/components/ui/backgrounds/registry';
import type { BackgroundType } from '@/components/ui/backgrounds/types';
import { cn } from '@/lib/utils';
import { SceneThemeContext } from '@/components/ui/backgrounds/scene-theme';

interface BackgroundPreviewProps {
  type: BackgroundType;
  settings: Record<string, unknown>;
  opacity?: number;
  blur?: number;
  /** Показать сцену в этой теме, а не в теме админа (вкладки фона по темам). */
  theme?: 'light' | 'dark';
  className?: string;
}

export function BackgroundPreview({
  type,
  settings,
  opacity,
  blur,
  theme,
  className,
}: BackgroundPreviewProps) {
  // Светлая сцена прозрачна и лежит на фоне страницы; в предпросмотре этот фон
  // даёт сама коробка, иначе под ней был бы тёмный bg-dark-900 админки.
  const groundStyle =
    theme === 'light' ? { background: 'rgb(var(--color-champagne-200))' } : undefined;
  if (type === 'none') {
    return (
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border border-dark-700/50 bg-dark-900',
          className,
        )}
      >
        <div className="flex h-full items-center justify-center text-dark-400">—</div>
      </div>
    );
  }

  const Component = backgroundComponents[type];
  if (!Component) return null;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-dark-700/50 bg-dark-900',
        className,
      )}
      style={groundStyle}
    >
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
          </div>
        }
      >
        <div
          style={{
            opacity: opacity != null ? opacity : undefined,
            filter: blur && blur > 0 ? `blur(${blur}px)` : undefined,
          }}
          className="absolute inset-0"
        >
          <SceneThemeContext.Provider value={theme ?? null}>
            <Component settings={settings} />
          </SceneThemeContext.Provider>
        </div>
      </Suspense>
    </div>
  );
}
