import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
import { sanitizeColor, safeSelect } from './types';
import { useScenePaused } from './use-scene-motion';
import './scene-backgrounds.css';

interface Props {
  settings: Record<string, unknown>;
  paused?: boolean;
}

// Positions follow the viewport (designed at 390×844, scaled with vw/vh/vmax),
// so the light reaches the whole screen on tablets and desktops too.
const DARK_BLOBS = [
  { drift: 1, left: '-44vw', top: '-17vh', size: '66vmax', opacity: 0.55, color: 0, duration: 46 },
  { drift: 2, left: '36vw', top: '36vh', size: '57vmax', opacity: 0.32, color: 1, duration: 37 },
  { drift: 3, left: '-31vw', top: '66vh', size: '62vmax', opacity: 0.48, color: 2, duration: 53 },
];
const LIGHT_BLOBS = [
  { drift: 1, left: '31vw', top: '-19vh', size: '62vmax', opacity: 0.13, color: 0, duration: 46 },
  { drift: 3, left: '-46vw', top: '62vh', size: '62vmax', opacity: 0.16, color: 1, duration: 53 },
];
const SPEED: Record<string, number> = { slow: 1.6, normal: 1, fast: 0.5 };
const MASK = 'radial-gradient(circle, #000 0%, rgba(0,0,0,.32) 38%, transparent 70%)';

export default function LiquidLightBackground({ settings, paused = false }: Props) {
  const { isLight } = useTheme();
  const still = useScenePaused(paused);
  const violet = sanitizeColor(settings.color1, '#9333EA');
  const colors = [
    isLight && violet.toUpperCase() === '#9333EA' ? '#A855F7' : violet,
    sanitizeColor(settings.color2, '#D68CFF'),
    sanitizeColor(settings.color3, '#7E22CE'),
  ];
  const speed = safeSelect(settings.speed, ['slow', 'normal', 'fast'], 'normal');

  return (
    <div
      aria-hidden="true"
      data-scene={isLight ? 'liquid-light-day' : 'liquid-light-night'}
      data-paused={still}
      className={cn('scene-background', still && 'scene-paused')}
      // The light palette already paints the page ground; keep it visible.
      style={{ background: isLight ? 'transparent' : 'rgb(var(--color-dark-950))' }}
    >
      {(isLight ? LIGHT_BLOBS : DARK_BLOBS).map((blob) => (
        <div
          key={blob.drift}
          className={`scene-blob scene-drift-${blob.drift}`}
          style={{
            left: blob.left,
            top: blob.top,
            width: blob.size,
            height: blob.size,
            backgroundColor: colors[blob.color],
            opacity: blob.opacity,
            maskImage: MASK,
            WebkitMaskImage: MASK,
            mixBlendMode: isLight ? 'normal' : 'screen',
            animationDuration: `${Number((blob.duration * SPEED[speed]).toFixed(1))}s`,
          }}
        />
      ))}
    </div>
  );
}
