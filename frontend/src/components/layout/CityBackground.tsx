import type { CSSProperties } from "react";

// Size of the drawing; it covers the screen and stays anchored at the bottom
const W = 1600;
const H = 900;
const HORIZON = 640;

// Same random city on every render (seeded generator, mulberry32)
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Building {
  x: number;
  w: number;
  h: number;
  windows: number; // which window pattern (0-2)
  sign?: { color: string; dy: number }; // vertical neon sign
  antenna: boolean;
}

// One row of buildings, from left to right, across the whole width
function skyline(
  seed: number,
  minW: number,
  maxW: number,
  minH: number,
  maxH: number,
  signs: number,
): Building[] {
  const rand = random(seed);
  const colors = ["primary", "secondary", "accent", "tertiary"];
  const row: Building[] = [];
  for (let x = -40; x < W + 40;) {
    const w = minW + rand() * (maxW - minW);
    const h = minH + rand() * (maxH - minH);
    row.push({
      x,
      w,
      h,
      windows: Math.floor(rand() * 3),
      sign:
        rand() < signs
          ? {
              color: colors[Math.floor(rand() * colors.length)],
              dy: 20 + rand() * 60,
            }
          : undefined,
      antenna: rand() < 0.25,
    });
    x += w + rand() * 6;
  }
  return row;
}

const FAR = skyline(7, 50, 110, 140, 330, 0);
const MID = skyline(21, 60, 130, 90, 260, 0.25);
const NEAR = skyline(42, 80, 170, 40, 190, 0.45);

// Theme colors for SVG paints (they follow the daisyUI theme)
const c = (name: string): CSSProperties["fill"] => `var(--color-${name})`;

// Lit windows: three tiles with different lit windows, in theme colors
function WindowPatterns({
  layer,
  opacity,
}: {
  layer: string;
  opacity: number;
}) {
  const tiles = [
    [0, 3, 5, 6],
    [1, 2, 7],
    [0, 4, 6, 8],
  ];
  const colors = ["secondary", "accent", "primary"];
  return (
    <>
      {tiles.map((lit, t) => (
        <pattern
          key={t}
          id={`win-${layer}-${t}`}
          width="24"
          height="36"
          patternUnits="userSpaceOnUse"
        >
          {Array.from({ length: 9 }).map((_, i) => (
            <rect
              key={i}
              x={3 + (i % 3) * 7}
              y={4 + Math.floor(i / 3) * 11}
              width="4"
              height="6"
              style={{
                fill: lit.includes(i)
                  ? c(colors[(i + t) % 3])
                  : c("base-content"),
                opacity: lit.includes(i) ? opacity : 0.04,
              }}
            />
          ))}
        </pattern>
      ))}
    </>
  );
}

function Row({
  buildings,
  layer,
  body,
}: {
  buildings: Building[];
  layer: string;
  body: string;
}) {
  return (
    <g>
      {buildings.map((b, i) => {
        const top = HORIZON - b.h;
        return (
          <g key={i}>
            {b.antenna && (
              <>
                <rect
                  x={b.x + b.w / 2 - 1}
                  y={top - 30}
                  width="2"
                  height="30"
                  style={{ fill: body }}
                />
                <circle
                  cx={b.x + b.w / 2}
                  cy={top - 31}
                  r="2.5"
                  style={{ fill: c("primary") }}
                  filter="url(#glow)"
                />
              </>
            )}
            <rect
              x={b.x}
              y={top}
              width={b.w}
              height={b.h}
              style={{ fill: body }}
            />
            <rect
              x={b.x + 4}
              y={top + 8}
              width={b.w - 8}
              height={Math.max(0, b.h - 16)}
              fill={`url(#win-${layer}-${b.windows})`}
            />
            {b.sign && (
              <rect
                x={b.x + b.w - 12}
                y={top + b.sign.dy}
                width="5"
                height={Math.min(90, b.h - b.sign.dy)}
                rx="2"
                style={{ fill: c(b.sign.color) }}
                filter="url(#glow)"
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

// Background of the whole site: a neon city at night, in the theme colors,
// fixed behind the pages and darkened so the content stays readable
export function CityBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-base-300"
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMax slice"
        className="size-full"
      >
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: c("base-300") }} />
            <stop
              offset="0.55"
              style={{ stopColor: c("tertiary"), stopOpacity: 0.35 }}
            />
            <stop
              offset="0.72"
              style={{ stopColor: c("primary"), stopOpacity: 0.45 }}
            />
          </linearGradient>
          {/* Ground: lit by the city at the horizon, dark at the bottom */}
          <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0"
              style={{ stopColor: c("primary"), stopOpacity: 0.3 }}
            />
            <stop offset="0.6" style={{ stopColor: c("base-300") }} />
          </linearGradient>
          <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: c("accent") }} />
            <stop offset="1" style={{ stopColor: c("primary") }} />
          </linearGradient>
          {/* Retro sun cut by horizontal stripes */}
          <mask id="sun-stripes">
            <rect width={W} height={H} fill="white" />
            {Array.from({ length: 8 }).map((_, i) => (
              <rect
                key={i}
                x="0"
                y={470 + i * 22}
                width={W}
                height={3 + i * 1.5}
                fill="black"
              />
            ))}
          </mask>
          <filter id="glow" x="-200%" y="-50%" width="500%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <WindowPatterns layer="far" opacity={0.25} />
          <WindowPatterns layer="mid" opacity={0.45} />
          <WindowPatterns layer="near" opacity={0.75} />
        </defs>

        {/* Sky, sun and the three rows of buildings, from far to near */}
        <rect width={W} height={H} fill="url(#sky)" />
        <circle
          cx={W / 2}
          cy={HORIZON - 120}
          r="200"
          fill="url(#sun)"
          mask="url(#sun-stripes)"
          opacity="0.8"
        />
        <Row buildings={FAR} layer="far" body="var(--color-neutral)" />
        <Row buildings={MID} layer="mid" body="var(--color-base-200)" />
        <Row buildings={NEAR} layer="near" body="var(--color-base-300)" />
        <rect
          y={HORIZON}
          width={W}
          height={H - HORIZON}
          style={{ fill: c("base-300") }}
        />
        <rect y={HORIZON} width={W} height={H - HORIZON} fill="url(#ground)" />

        {/* Neon grid on the ground, in perspective */}
        <g style={{ stroke: c("secondary"), opacity: 0.35 }} strokeWidth="1.5">
          <line x1="0" y1={HORIZON} x2={W} y2={HORIZON} />
          {Array.from({ length: 7 }).map((_, i) => {
            const y = HORIZON + 8 * (i + 1) ** 1.7;
            return <line key={`h${i}`} x1="0" y1={y} x2={W} y2={y} />;
          })}
          {Array.from({ length: 25 }).map((_, i) => {
            const x = (i - 12) * 160;
            return (
              <line
                key={`v${i}`}
                x1={W / 2 + x * 0.08}
                y1={HORIZON}
                x2={W / 2 + x * 1.6}
                y2={H}
              />
            );
          })}
        </g>
      </svg>

      {/* Darkens the city behind the content */}
      <div className="absolute inset-0 bg-linear-to-b from-base-300/80 via-base-300/55 to-base-300/40" />
    </div>
  );
}
