import { cn } from '@/lib/utils';
import { sanitizeColor, safeSelect } from './types';
import { useSceneIsLight } from './scene-theme';
import { useScenePaused } from './use-scene-motion';
import './scene-backgrounds.css';

interface Props {
  settings: Record<string, unknown>;
  paused?: boolean;
}

const SPEED: Record<string, number> = { slow: 1.6, normal: 1, fast: 0.5 };
const MASK = 'radial-gradient(closest-side, #000, rgba(0,0,0,.45) 45%, transparent 80%)';

export default function HaloBackground({ settings, paused = false }: Props) {
  const isLight = useSceneIsLight();
  const still = useScenePaused(paused);
  const violet = sanitizeColor(settings.color1, '#9333EA');
  const color1 = isLight && violet.toUpperCase() === '#9333EA' ? '#A855F7' : violet;
  const color2 = sanitizeColor(settings.color2, '#D68CFF');
  const color3 = sanitizeColor(settings.color3, '#7E22CE');
  const speed = SPEED[safeSelect(settings.speed, ['slow', 'normal', 'fast'], 'normal')];
  const duration = (seconds: number) => Number((seconds * speed).toFixed(2));
  const layerStyle = {
    mixBlendMode: isLight ? 'normal' : 'screen',
    pointerEvents: 'none',
  } as const;

  return (
    <div
      aria-hidden="true"
      data-scene={isLight ? 'halo-day' : 'halo-night'}
      data-paused={still}
      className={cn('scene-background', still && 'scene-paused')}
      // Без position: fixed — сцену кладут и в маленький предпросмотр админки, а fixed
      // вырывал её из коробки и закрывал всю страницу. Во весь экран её растягивает
      // контейнер BackgroundRenderer.
      style={{ background: isLight ? 'transparent' : 'rgb(var(--color-dark-950))' }}
    >
      <div
        className="scene-blob"
        style={{
          ...layerStyle,
          left: '-15vw',
          top: '-42vh',
          width: '130vw',
          height: '100vh',
          background: `radial-gradient(closest-side, color-mix(in srgb, ${color1} ${isLight ? 26 : 62}%, transparent), color-mix(in srgb, ${color1} ${isLight ? 9 : 22}%, transparent) 48%, transparent 100%)`,
          animation: `scene-breathe ${duration(9)}s ease-in-out infinite alternate`,
        }}
      />
      <div
        className="scene-blob"
        style={{
          ...layerStyle,
          left: 'calc(50vw - (30vw + 20vh))',
          top: 'calc(-12vh - (30vw + 20vh))',
          width: 'calc(60vw + 40vh)',
          height: 'calc(60vw + 40vh)',
          background: `conic-gradient(from 0deg, ${color1}, ${color2}, ${color3}, ${color2}, ${color1})`,
          maskImage: MASK,
          WebkitMaskImage: MASK,
          opacity: isLight ? 0.12 : 0.32,
          animation: `scene-spin ${duration(48)}s linear infinite`,
        }}
      />
      <div
        className="scene-blob"
        style={{
          ...layerStyle,
          left: '5vw',
          top: '78vh',
          width: '90vw',
          height: '50vh',
          background: `radial-gradient(closest-side, color-mix(in srgb, ${color3} ${isLight ? 12 : 30}%, transparent), transparent)`,
          animation: `scene-breathe ${duration(11)}s ease-in-out infinite alternate-reverse`,
        }}
      />
    </div>
  );
}
