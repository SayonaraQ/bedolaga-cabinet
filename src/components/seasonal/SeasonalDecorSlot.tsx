import type { ComponentType, CSSProperties, ReactNode } from 'react';
import { useTheme } from '@/hooks/useTheme';
import type { Season } from '@/theme/appearance';
import { LeafDrift, LeafRow, MapleCluster } from './art/autumn';
import { GardenBed, GardenDaffodil, GardenTulip } from './art/spring';
import { Beach, Palm, Shell, Wave } from './art/summer';
import { SnowCap, SnowFull, Snowman, SnowRight } from './art/winter';
import './seasonalDecor.css';

type Slot = 'corner' | 'connect' | 'renew';
interface DecorPiece {
  Art: ComponentType;
  style: CSSProperties;
}

// Positions and sizes from the reference mockup's DECOR table.
const DECOR: Record<Season, Record<Slot, DecorPiece[]>> = {
  winter: {
    corner: [
      { Art: SnowCap, style: { left: 10, top: -17, width: 'min(171px,48cqw)', height: 28 } },
      { Art: Snowman, style: { right: -2, top: -66, width: 'min(76px,22cqw)', height: 82 } },
    ],
    connect: [
      { Art: SnowRight, style: { right: 6, top: -17, width: 'min(158px,55cqw)', height: 25 } },
    ],
    renew: [{ Art: SnowFull, style: { left: 4, right: 4, top: -18, height: 25 } }],
  },
  spring: {
    corner: [
      { Art: GardenBed, style: { right: 0, top: -83, width: 'min(100px,29cqw)', height: 96 } },
    ],
    connect: [{ Art: GardenTulip, style: { right: 3, top: -16, width: 34, height: 42 } }],
    renew: [{ Art: GardenDaffodil, style: { left: -8, top: -20, width: 41, height: 42 } }],
  },
  summer: {
    corner: [
      { Art: Beach, style: { left: 9, top: -17, width: 'min(142px,40cqw)', height: 27 } },
      { Art: Palm, style: { right: -10, top: -47, width: 'min(81px,24cqw)', height: 62 } },
    ],
    connect: [{ Art: Shell, style: { right: 5, top: -24, width: 46, height: 32 } }],
    renew: [{ Art: Wave, style: { left: 4, right: 4, top: -19, height: 29 } }],
  },
  autumn: {
    corner: [
      { Art: MapleCluster, style: { right: -4, top: -44, width: 'min(84px,25cqw)', height: 64 } },
    ],
    connect: [
      { Art: LeafDrift, style: { right: 6, top: -17, width: 'min(198px,56cqw)', height: 30 } },
    ],
    renew: [{ Art: LeafRow, style: { left: 6, top: -13, width: 64, height: 24 } }],
  },
};

/** Keep this outside overflow-hidden cards/buttons. The layer never takes up space. */
export function SeasonalDecorSlot({
  slot,
  children,
  off,
}: {
  slot: Slot;
  children: ReactNode;
  off?: boolean;
}) {
  const { season, seasonalActive, isLight } = useTheme();
  if (off || !seasonalActive || !season) return children;

  return (
    <div className="seasonal-decor-slot" data-seasonal-slot={slot}>
      {children}
      <div
        aria-hidden="true"
        className={`seasonal-decor-layer pointer-events-none absolute inset-0 z-[6]${isLight ? ' seasonal-decor-day' : ''}`}
      >
        {DECOR[season][slot].map(({ Art, style }, index) => (
          // Static list per season/slot; function names are not stable after minification.
          <div key={index} className="absolute" style={style}>
            <Art />
          </div>
        ))}
      </div>
    </div>
  );
}
