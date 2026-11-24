import {
  COLOR_NAME,
  SKIN_ROOT,
  glyph,
  isAction,
  valueLabel,
  type FaceProps,
  type Skin,
  type SuitColor,
  type WildProps,
} from "./common";

// Art deco: a precious lacquer in the color, gold ornaments

const GOLD = "#e8c766";
const DECO: Record<
  SuitColor,
  { bg: string; bright: string; orn: string; gem: string }
> = {
  red: { bg: "#8c0d22", bright: "#d42a45", orn: GOLD, gem: "Ruby" },
  yellow: { bg: "#d99e00", bright: "#ffd34d", orn: "#1a1405", gem: "Topaz" },
  green: { bg: "#0c5e3c", bright: "#1fa36a", orn: GOLD, gem: "Emerald" },
  blue: { bg: "#0f3474", bright: "#2a64c4", orn: GOLD, gem: "Sapphire" },
};
const CORNERS = [
  "top-1 left-1",
  "top-1 right-1",
  "bottom-1 left-1",
  "bottom-1 right-1",
];

function Ornaments({ orn }: { orn: string }) {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-2 border"
        style={{ borderColor: orn + "99" }}
      />
      {CORNERS.map((pos) => (
        <span
          key={pos}
          className={`pointer-events-none absolute ${pos} h-2.5 w-2.5 rotate-45`}
          style={{ background: orn }}
        />
      ))}
    </>
  );
}

function Face({ color, value }: FaceProps) {
  const p = DECO[color];
  return (
    <div
      className={`${SKIN_ROOT} justify-between border-2 p-3 font-serif`}
      style={{
        borderColor: p.orn,
        background: `radial-gradient(circle at 50% 115%, ${p.bright}, ${p.bg} 70%)`,
        color: p.orn,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          background: `repeating-conic-gradient(from -90deg at 50% 110%, ${p.orn} 0deg 1.5deg, transparent 1.5deg 9deg)`,
        }}
      />
      <Ornaments orn={p.orn} />

      <div className="z-10 pt-2 text-center">
        <span className="text-[9px] tracking-[0.5em] uppercase">
          ◆ {p.gem} ◆
        </span>
      </div>

      <div className="z-10 my-auto flex flex-col items-center">
        <span
          className={`leading-none font-light ${isAction(value) ? "text-[80px]" : "text-[110px]"}`}
        >
          {glyph(value)}
        </span>
        <div className="mt-2 flex items-center gap-2">
          <span className="h-px w-8" style={{ background: p.orn }} />
          <span
            className="h-1.5 w-1.5 rotate-45"
            style={{ background: p.orn }}
          />
          <span className="h-px w-8" style={{ background: p.orn }} />
        </div>
        <span className="mt-2 text-[11px] font-bold tracking-[0.4em] uppercase">
          {COLOR_NAME[color]}
        </span>
      </div>

      <div className="z-10 pb-2 text-center text-[9px] tracking-[0.4em] uppercase opacity-80">
        {valueLabel(value)}
      </div>
    </div>
  );
}

function Wild({ value }: WildProps) {
  return (
    <div
      className={`${SKIN_ROOT} group border-2 border-[#e8c766] bg-[#0b0b0b] p-3 font-serif`}
    >
      <div
        className="pointer-events-none absolute -bottom-36 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full transition-transform duration-700 group-hover:scale-110"
        style={{
          background: `conic-gradient(from -90deg, ${DECO.red.bright} 0deg 45deg, ${DECO.yellow.bright} 45deg 90deg, ${DECO.green.bright} 90deg 135deg, ${DECO.blue.bright} 135deg 180deg, transparent 180deg)`,
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-36 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full"
        style={{
          background:
            "repeating-conic-gradient(from -90deg, #0b0b0b 0deg 1.2deg, transparent 1.2deg 11.25deg)",
        }}
      />
      <div className="pointer-events-none absolute -bottom-12 left-1/2 h-24 w-24 -translate-x-1/2 rounded-full border-2 border-[#e8c766] bg-[#0b0b0b]" />
      <div className="pointer-events-none absolute inset-2 border border-[#e8c766]/60" />

      <div className="z-10 pt-2 text-center">
        <span className="text-[9px] tracking-[0.5em] text-[#e8c766] uppercase">
          ◆ Wild ◆
        </span>
      </div>
      <div className="z-10 mt-6 flex flex-col items-center">
        <span
          className={`bg-gradient-to-b from-[#f5e6a8] via-[#e8c766] to-[#8a6d1d] bg-clip-text font-light text-transparent ${value === "wild_draw4" ? "text-7xl" : "text-5xl"}`}
        >
          {value === "wild_draw4" ? "+4" : "BAL"}
        </span>
        <span className="mt-2 text-xs tracking-[0.4em] text-[#e9d9a6] uppercase">
          The Grand Ball
        </span>
      </div>
    </div>
  );
}

function Back() {
  return (
    <div
      className={`${SKIN_ROOT} items-center justify-center border-2 border-[#e8c766] bg-[#0b0b0b] font-serif`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            "repeating-conic-gradient(from 0deg at 50% 50%, #e8c766 0deg 1.5deg, transparent 1.5deg 12deg)",
        }}
      />
      <Ornaments orn={GOLD} />
      <div className="z-10 flex h-24 w-24 rotate-45 items-center justify-center border-2 border-[#e8c766] bg-[#0b0b0b]">
        <span className="-rotate-45 text-2xl tracking-[0.2em] text-[#e8c766]">
          SNS
        </span>
      </div>
    </div>
  );
}

export const DECO_SKIN: Skin = {
  id: "deco",
  label: "Art Deco",
  subtitle: "Ruby, topaz, emerald, sapphire lacquer",
  accent: GOLD,
  Face,
  Wild,
  Back,
};
