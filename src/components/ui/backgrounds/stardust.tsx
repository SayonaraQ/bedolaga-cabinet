import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
import { sanitizeColor, safeSelect } from './types';
import { useSceneMedia, useScenePaused } from './use-scene-motion';
import './scene-backgrounds.css';

interface Props {
  settings: Record<string, unknown>;
  paused?: boolean;
}

interface StarShadowOptions {
  count: number;
  seed: number;
  minR: number;
  maxR: number;
  minA: number;
  maxA: number;
  colour: (alpha: number, tinted: boolean) => string;
}

/** Repeat each seeded star below the viewport so the rising sky loops without a seam. */
export function buildStarShadow({
  count,
  seed,
  minR,
  maxR,
  minA,
  maxA,
  colour,
}: StarShadowOptions): string {
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const shadows: string[] = [];
  for (let i = 0; i < count; i++) {
    // Keep rounded coordinates inside [0, 100), even at the viewport edge.
    const x = Math.min(99.99, Number((random() * 100).toFixed(2)));
    const y = Math.min(99.99, Number((random() * 100).toFixed(2)));
    const radius = (minR + random() * (maxR - minR)).toFixed(2);
    const alpha = minA + random() * (maxA - minA);
    const color = colour(alpha, random() >= 0.7);
    shadows.push(`${x}vw ${y}vh 0 ${radius}px ${color}`);
    shadows.push(`${x}vw ${Number((y + 100).toFixed(2))}vh 0 ${radius}px ${color}`);
  }
  return shadows.join(', ');
}

const SPEED: Record<string, number> = { slow: 1.6, normal: 1, fast: 0.5 };
const MASK = 'radial-gradient(circle, #000 0%, rgba(0,0,0,.32) 38%, transparent 70%)';
const SIZE = 'calc(30vmin + 26vmax)';
const NEBULAE = [
  {
    x: '96vw',
    y: '4vh',
    opacity: 0.42,
    lightOpacity: 0.14,
    animation: 'scene-corner-b',
    duration: 26,
  },
  {
    x: '2vw',
    y: '98vh',
    opacity: 0.3,
    lightOpacity: 0.12,
    animation: 'scene-corner-c',
    duration: 32,
  },
];

export default function StardustBackground({ settings, paused = false }: Props) {
  const { isLight } = useTheme();
  const still = useScenePaused(paused);
  const desktop = useSceneMedia('(min-width: 1024px)');
  const violet = sanitizeColor(settings.color1, '#9333EA');
  const color1 = isLight && violet.toUpperCase() === '#9333EA' ? '#A855F7' : violet;
  const color2 = sanitizeColor(settings.color2, '#D68CFF');
  const speed = SPEED[safeSelect(settings.speed, ['slow', 'normal', 'fast'], 'normal')];
  const duration = (seconds: number) => Number((seconds * speed).toFixed(2));
  const countA = desktop ? 135 : 60;
  const countB = desktop ? 57 : 24;
  const shadows = useMemo(() => {
    const colour = (alpha: number, tinted: boolean) =>
      isLight
        ? `rgba(147,51,234,${(alpha * 0.55).toFixed(3)})`
        : tinted
          ? `color-mix(in srgb, ${color2} ${(alpha * 100).toFixed(2)}%, transparent)`
          : `rgba(245,240,255,${alpha.toFixed(3)})`;
    return [
      buildStarShadow({
        count: countA,
        seed: 42,
        minR: 0.2,
        maxR: 0.7,
        minA: 0.35,
        maxA: 0.8,
        colour,
      }),
      buildStarShadow({
        count: countB,
        seed: 137,
        minR: 0.5,
        maxR: 1.1,
        minA: 0.6,
        maxA: 1,
        colour,
      }),
    ];
  }, [countA, countB, isLight, color2]);
  const layerStyle = {
    mixBlendMode: isLight ? 'normal' : 'screen',
    pointerEvents: 'none',
  } as const;

  return (
    <div
      aria-hidden="true"
      data-scene={isLight ? 'stardust-day' : 'stardust-night'}
      data-paused={still}
      className={cn('scene-background', still && 'scene-paused')}
      // Без position: fixed — сцену кладут и в маленький предпросмотр админки, а fixed
      // вырывал её из коробки и закрывал всю страницу. Во весь экран её растягивает
      // контейнер BackgroundRenderer.
      style={{ background: isLight ? 'transparent' : 'rgb(var(--color-dark-950))' }}
    >
      {NEBULAE.map((nebula, index) => (
        <div
          key={nebula.animation}
          className="scene-blob"
          style={{
            ...layerStyle,
            left: `calc(${nebula.x} - (30vmin + 26vmax) / 2)`,
            top: `calc(${nebula.y} - (30vmin + 26vmax) / 2)`,
            width: SIZE,
            height: SIZE,
            backgroundColor: index === 0 ? color1 : color2,
            opacity: isLight ? nebula.lightOpacity : nebula.opacity,
            maskImage: MASK,
            WebkitMaskImage: MASK,
            animation: `${nebula.animation} ${duration(nebula.duration)}s ease-in-out infinite`,
          }}
        />
      ))}
      {shadows.map((shadow, index) => (
        <div
          key={index}
          data-star-layer={index === 0 ? 'dust' : 'twinkling'}
          style={{
            ...layerStyle,
            position: 'absolute',
            left: 0,
            top: 0,
            width: 1,
            height: 1,
            borderRadius: '50%',
            boxShadow: shadow,
            willChange: index === 0 ? 'transform' : 'transform, opacity',
            animation:
              index === 0
                ? `scene-rise ${duration(140)}s linear infinite`
                : `scene-rise ${duration(90)}s linear infinite, scene-twinkle ${duration(3.6)}s ease-in-out infinite alternate`,
          }}
        />
      ))}
    </div>
  );
}
