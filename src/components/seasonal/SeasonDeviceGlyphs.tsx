// Device glyphs carry the season: the owner's picks are maple, flake, blossom and palm.
import type { CSSProperties, JSX } from 'react';
import type { Season } from '@/theme/appearance';

export type SeasonGlyphKind = 'maple' | 'flake' | 'blossom' | 'palm';

export const SEASON_DEVICE_GLYPHS: Record<
  Season,
  { kind: SeasonGlyphKind; palette?: { night: string[]; day: string[] } }
> = {
  autumn: {
    kind: 'maple',
    palette: {
      night: ['#FF9426', '#EA580C', '#FFB347', '#C2410C'],
      day: ['#E8771E', '#C2410C', '#D97706', '#B45309'],
    },
  },
  winter: { kind: 'flake' },
  spring: { kind: 'blossom' },
  summer: {
    kind: 'palm',
    palette: {
      night: ['#FFB38A', '#FFD27A', '#7DD3FC', '#FF8A65'],
      day: ['#F97316', '#F59E0B', '#0EA5E9', '#EF4444'],
    },
  },
};

const rad = (deg: number) => (deg * Math.PI) / 180;
const pt = (r: number, deg: number) =>
  `${(12 + r * Math.cos(rad(deg))).toFixed(2)} ${(12 + r * Math.sin(rad(deg))).toFixed(2)}`;

// Six arms with a V near each tip.
const FLAKE = [0, 60, 120, 180, 240, 300]
  .map((a) => {
    const tip = `M12 12L${pt(10, a)}`;
    const base = 6.6;
    const bx = 12 + base * Math.cos(rad(a));
    const by = 12 + base * Math.sin(rad(a));
    const v = (s: number) =>
      `${(bx + 3 * Math.cos(rad(a + s))).toFixed(2)} ${(by + 3 * Math.sin(rad(a + s))).toFixed(2)}`;
    return `${tip}M${v(40)}L${bx.toFixed(2)} ${by.toFixed(2)}L${v(-40)}`;
  })
  .join('');

// Chunky maple for 12px: five broad lobes (top, two sides, two small bottom).
const MAPLE = (() => {
  const c = { x: 12, y: 11 };
  // Angles in drawing order (unwrapped), radius per lobe.
  const lobes: [number, number][] = [
    [-90, 10],
    [-25, 10],
    [35, 6.2],
    [145, 6.2],
    [205, 10],
  ];
  const at = (r: number, deg: number, squash = 1) =>
    `${(c.x + r * Math.cos(rad(deg))).toFixed(2)} ${(c.y + r * squash * Math.sin(rad(deg))).toFixed(2)}`;
  const pts: string[] = [];
  lobes.forEach(([a, r], k) => {
    const next = k + 1 < lobes.length ? lobes[k + 1][0] : lobes[0][0] + 360;
    pts.push(at(r * 0.86, a - 13), at(r, a), at(r * 0.86, a + 13), at(3.6, (a + next) / 2));
  });
  return `M${pts.join('L')}Z`;
})();

const PALM_FRONDS =
  'M12 8C8.5 5 4.5 5.6 2 9c3-1.2 6.4-1.4 10-1zM12 8c3.5-3 7.5-2.4 10 1-3-1.2-6.4-1.4-10-1zM12 8C10.8 4.2 8 2 4.6 2.2 7.4 3.8 9.8 5.6 12 8zM12 8c1.2-3.8 4-6 7.4-5.8C16.6 3.8 14.2 5.6 12 8z';

function Shape({ kind, color, center }: { kind: SeasonGlyphKind; color: string; center?: string }) {
  if (kind === 'maple')
    return (
      <>
        <path d={MAPLE} fill={color} stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
        <path d="M12 15.5v7" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      </>
    );
  if (kind === 'flake')
    return (
      <path
        d={FLAKE}
        fill="none"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  if (kind === 'blossom')
    return (
      <>
        {[0, 1, 2, 3, 4].map((k) => {
          const a = -90 + k * 72;
          return (
            <circle
              key={k}
              cx={12 + 5.4 * Math.cos(rad(a))}
              cy={12 + 5.4 * Math.sin(rad(a))}
              r={4.6}
              fill={color}
            />
          );
        })}
        {center && <circle cx={12} cy={12} r={2.7} fill={center} />}
      </>
    );
  return (
    <>
      <path
        d="M12.6 22.5C12.2 17.5 11.4 12.6 12 8"
        fill="none"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <path d={PALM_FRONDS} fill={color} stroke={color} strokeWidth={0.8} strokeLinejoin="round" />
    </>
  );
}

export function SeasonDeviceGlyphs({
  season,
  isLight,
  limit,
  used,
  zoneHex,
  ghost,
}: {
  season: Season;
  isLight: boolean;
  limit: number;
  used: number;
  zoneHex: string;
  ghost: string;
}): JSX.Element {
  const { kind, palette } = SEASON_DEVICE_GLYPHS[season];
  const colors = isLight ? palette?.day : palette?.night;
  const center = isLight ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,.4)';
  const clampedUsed = Math.max(0, Math.min(used, limit));
  const size = 12;
  const wrap: CSSProperties =
    limit > 5
      ? { display: 'grid', gridTemplateColumns: `repeat(5, ${size}px)`, gap: 4 }
      : { display: 'flex', gap: 5 };
  return (
    <div
      className="flex-shrink-0"
      style={wrap}
      aria-hidden="true"
      data-season-glyphs={season}
      data-glyph-kind={kind}
    >
      {Array.from({ length: limit }, (_, i) => {
        const on = i < clampedUsed;
        const color = on ? (colors ? colors[i % colors.length] : zoneHex) : ghost;
        const glow = on && !isLight ? `drop-shadow(0 0 3px ${color}66)` : undefined;
        return (
          <svg
            key={i}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            data-glyph-state={on ? 'on' : 'off'}
            style={{
              filter: glow,
              transform: season === 'autumn' ? `rotate(${(i % 2) * 16 - 8}deg)` : undefined,
            }}
          >
            <Shape
              kind={kind}
              color={color}
              center={on && kind === 'blossom' ? center : undefined}
            />
          </svg>
        );
      })}
    </div>
  );
}
