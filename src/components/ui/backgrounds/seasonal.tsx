import { useMemo, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import type { SeasonalAppearanceId } from '@/theme/appearance';
import { useSceneMedia, useScenePaused } from './use-scene-motion';
import './scene-backgrounds.css';

interface Props {
  appearance: SeasonalAppearanceId;
  paused?: boolean;
}

interface Scene {
  ground: string;
  glow?: string;
  kind: 'snow' | 'mote' | 'sea' | 'leaf';
  seed: number;
}

const SCENES: Record<SeasonalAppearanceId, Scene> = {
  'winter-night': {
    ground: '#020914',
    glow: 'radial-gradient(ellipse 70% 22% at 35% 14%,rgba(34,211,238,0.30),transparent 70%),radial-gradient(ellipse 60% 20% at 72% 8%,rgba(184,90,255,0.36),transparent 70%),radial-gradient(circle at 20% 92%,rgba(34,211,238,0.12),transparent 50%)',
    kind: 'snow',
    seed: 1000,
  },
  'winter-day': {
    ground: 'linear-gradient(180deg,#DCEAF4,#E7F0F7 40%,#EEF4F9)',
    glow: 'radial-gradient(ellipse 70% 20% at 32% 12%,rgba(56,189,248,0.20),transparent 70%),radial-gradient(ellipse 55% 18% at 74% 7%,rgba(167,139,250,0.16),transparent 70%)',
    kind: 'snow',
    seed: 1500,
  },
  'spring-night': {
    ground: '#071B1A',
    glow: 'radial-gradient(circle at 82% 10%,rgba(255,155,159,0.22),transparent 46%),radial-gradient(circle at 12% 90%,rgba(160,214,183,0.20),transparent 52%)',
    kind: 'mote',
    seed: 2000,
  },
  'spring-day': {
    ground: '#F7F3E9',
    glow: 'radial-gradient(circle at 82% 8%,rgba(255,155,159,0.30),transparent 48%),radial-gradient(circle at 12% 92%,rgba(113,157,122,0.20),transparent 52%)',
    kind: 'mote',
    seed: 2500,
  },
  'summer-night': {
    ground: 'linear-gradient(180deg,#0A1F3A 0%,#061522 40%,#08304A 62%,#0B3F55 100%)',
    kind: 'sea',
    seed: 0,
  },
  'summer-day': {
    ground: 'linear-gradient(180deg,#BFE6F2 0%,#E1F3F6 36%,#A6DEDF 60%,#7CCACE 78%,#EADCB8 100%)',
    kind: 'sea',
    seed: 0,
  },
  'autumn-night': {
    ground: '#130A05',
    glow: 'radial-gradient(circle at 85% 12%,rgba(255,148,38,0.20),transparent 45%),radial-gradient(circle at 12% 88%,rgba(255,208,120,0.12),transparent 50%)',
    kind: 'leaf',
    seed: 4000,
  },
  'autumn-day': {
    ground: '#F8F0E6',
    glow: 'radial-gradient(circle at 85% 10%,rgba(255,148,38,0.18),transparent 46%),radial-gradient(circle at 12% 90%,rgba(224,164,88,0.16),transparent 52%)',
    kind: 'leaf',
    seed: 4500,
  },
};

const LEAF_PATH =
  'M12 1.5c1.2 2.4 2.2 3.4 4.2 3.4-.4 1.6 0 2.6 1.6 3.4-1.4.8-1.8 1.8-1 3.4 1.8-.6 3.2-.2 4.6 1.2-2.4 1.4-4.6 2-6.8 1.6l.6 3.2-2.2-1.2-.6 5.5h-.8l-.6-5.5-2.2 1.2.6-3.2c-2.2.4-4.4-.2-6.8-1.6 1.4-1.4 2.8-1.8 4.6-1.2.8-1.6.4-2.6-1-3.4 1.6-.8 2-1.8 1.6-3.4 2 0 3-1 4.2-3.4z';
const LEAF_FILLS = ['#FF9426', '#EA580C', '#FFB347', '#C2410C'];

// Same seed function as the mockup: no random render-time positions or DOM measurements.
function random(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function SceneParticles({ scene, day, mobile }: { scene: Scene; day: boolean; mobile: boolean }) {
  const particles = useMemo(() => {
    const count = scene.kind === 'snow' ? 44 : scene.kind === 'sea' ? 9 : 16;
    return Array.from({ length: mobile ? Math.floor(count / 2) : count }, (_, index) => {
      const i = mobile && scene.kind === 'sea' ? index * 2 : index;
      const q = (k: number) => random(scene.seed + i * 17 + k);
      const style: CSSProperties = {};
      let animation = '';
      let art: 'flake' | 'leaf' | undefined;

      if (scene.kind === 'sea') {
        animation = 'scene-sea';
        style.top = `${(60 + i * 3.6).toFixed(1)}%`;
        style.animationDuration = `${7 + (i % 4) * 2}s`;
        style.animationDelay = `${-i * 1.3}s`;
        const color = day ? 'rgba(255,255,255,.55)' : `rgba(255,236,190,${i < 4 ? 0.2 : 0.13})`;
        style.background = `linear-gradient(90deg,transparent,${color},transparent)`;
      } else {
        style.left = `${(scene.kind === 'mote' ? 4 + q(2) * 92 : q(2) * 100).toFixed(1)}%`;
        const flake = scene.kind === 'snow' && i % 9 === 0;
        let size: number;
        let duration: number;
        let delayRange: number;
        if (scene.kind === 'snow') {
          size = flake ? 12 + Math.round(q(1) * 6) : 2 + Math.round(q(1) * 2.5);
          duration = flake ? 16 : 9 + q(3) * 9;
          delayRange = 18;
        } else if (scene.kind === 'mote') {
          size = 3 + Math.round(q(1) * 2);
          duration = 4 + q(3) * 4;
          delayRange = 8;
        } else {
          size = 16 + Math.round(q(1) * 10);
          duration = 13 + q(3) * 9;
          delayRange = 22;
        }
        style.width = size;
        style.height = size;
        style.animationDuration = `${duration.toFixed(1)}s`;
        style.animationDelay = `${(-q(4) * delayRange).toFixed(1)}s`;

        if (scene.kind === 'mote') {
          animation = 'scene-fly';
          style.top = `${(14 + q(6) * 76).toFixed(1)}%`;
          style.borderRadius = '50%';
          style.background = day ? '#E2B451' : '#F6D27A';
          style.boxShadow = day
            ? '0 0 6px 1px rgba(226,180,81,.45)'
            : '0 0 10px 3px rgba(246,210,122,.5)';
        } else if (scene.kind === 'leaf' || flake) {
          animation = i % 2 ? 'scene-spin-a' : 'scene-spin-b';
          art = flake ? 'flake' : 'leaf';
          style.opacity = flake ? (day ? 0.9 : 0.85) : Number((0.55 + q(5) * 0.35).toFixed(2));
          if (flake && day) style.filter = 'drop-shadow(0 1px 2px rgba(60,110,150,.55))';
        } else {
          animation = i % 2 ? 'scene-fall-a' : 'scene-fall-b';
          style.borderRadius = '50%';
          style.background = '#FFFFFF';
          style.opacity = Number((0.45 + q(5) * 0.5).toFixed(2));
          style.boxShadow = day
            ? '0 0 0 1px rgba(111,159,194,.35),0 1px 3px rgba(60,110,150,.45)'
            : '0 0 6px rgba(224,250,255,.6)';
        }
      }

      return (
        <span
          key={i}
          data-particle={scene.kind}
          className={cn(scene.kind !== 'sea' && 'scene-particle', animation)}
          style={style}
        >
          {art === 'flake' && (
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#E0FAFF"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <path d="M12 2v20M3.3 7l17.4 10M3.3 17l17.4-10M12 2l-2 2M12 2l2 2M12 22l-2-2M12 22l2-2" />
            </svg>
          )}
          {art === 'leaf' && (
            <svg width="100%" height="100%" viewBox="0 0 24 24">
              <path fill={LEAF_FILLS[i % 4]} d={LEAF_PATH} />
            </svg>
          )}
        </span>
      );
    });
  }, [scene, day, mobile]);
  return particles;
}

export default function SeasonalBackground({ appearance, paused = false }: Props) {
  const still = useScenePaused(paused);
  const mobile = useSceneMedia('(max-width: 767px)');
  const scene = SCENES[appearance];
  const day = appearance.endsWith('-day');

  return (
    <div
      aria-hidden="true"
      data-scene={appearance}
      data-paused={still}
      className={cn('scene-background', still && 'scene-paused')}
      style={{ background: scene.ground }}
    >
      {scene.glow && <div className="scene-aurora" style={{ background: scene.glow }} />}
      {scene.kind === 'sea' && (
        <>
          <div
            className="scene-orb"
            style={
              day
                ? {
                    right: 122,
                    top: 58,
                    width: 52,
                    height: 52,
                    background: 'radial-gradient(circle,#FFFBE8,#FFE59A)',
                    boxShadow: '0 0 60px 20px rgba(255,229,154,.5)',
                  }
                : {
                    right: 128,
                    top: 66,
                    width: 40,
                    height: 40,
                    background: 'radial-gradient(circle at 40% 40%,#FFF8E4,#F3DFA8)',
                    boxShadow: '0 0 50px 12px rgba(255,236,180,.28)',
                  }
            }
          />
          {!day && (
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse 14% 30% at 64% 76%,rgba(255,236,180,0.16),transparent 70%)',
              }}
            />
          )}
        </>
      )}
      <SceneParticles scene={scene} day={day} mobile={mobile} />
    </div>
  );
}
