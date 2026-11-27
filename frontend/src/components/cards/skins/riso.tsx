import {
  COLOR_NAME,
  SKIN_ROOT,
  SUITS,
  glyph,
  isAction,
  valueLabel,
  type FaceProps,
  type Skin,
  type SuitColor,
  type WildProps,
} from "./common";

// Risograph: one flat ink per color on a paper margin, halftone fade

const RISO_PAPER = "#f7f3ea";
const RISO: Record<
  SuitColor,
  { ink: string; dot: string; num: string; shadow: string; text: string }
> = {
  red: {
    ink: "#f2464f",
    dot: "#b8152a",
    num: RISO_PAPER,
    shadow: "#1d1d1b",
    text: RISO_PAPER,
  },
  yellow: {
    ink: "#ffe600",
    dot: "#d9a900",
    num: "#1d1d1b",
    shadow: RISO_PAPER,
    text: "#1d1d1b",
  },
  green: {
    ink: "#00a95c",
    dot: "#00733f",
    num: RISO_PAPER,
    shadow: "#1d1d1b",
    text: RISO_PAPER,
  },
  blue: {
    ink: "#0078bf",
    dot: "#004d80",
    num: RISO_PAPER,
    shadow: "#1d1d1b",
    text: RISO_PAPER,
  },
};

function Overprint({ size }: { size: string }) {
  return (
    <div className={`relative ${size}`}>
      <div
        className="absolute top-0 left-0 size-[62%] rounded-full mix-blend-multiply"
        style={{ background: RISO.red.ink }}
      />
      <div
        className="absolute top-0 right-0 size-[62%] rounded-full mix-blend-multiply"
        style={{ background: RISO.yellow.ink }}
      />
      <div
        className="absolute bottom-0 left-0 size-[62%] rounded-full mix-blend-multiply"
        style={{ background: RISO.green.ink }}
      />
      <div
        className="absolute right-0 bottom-0 size-[62%] rounded-full mix-blend-multiply"
        style={{ background: RISO.blue.ink }}
      />
    </div>
  );
}

function Face({ color, value }: FaceProps) {
  const p = RISO[color];
  return (
    <div
      className={`${SKIN_ROOT} rounded-sm p-2 font-mono`}
      style={{ background: RISO_PAPER, boxShadow: `5px 6px 0 ${p.dot}` }}
    >
      <div
        className="relative flex flex-1 flex-col justify-between overflow-hidden p-3"
        style={{ background: p.ink, transform: "translate(1px, -1px)" }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(${p.dot} 1.6px, transparent 1.8px)`,
            backgroundSize: "6px 6px",
            WebkitMaskImage:
              "linear-gradient(140deg, transparent 35%, #000 100%)",
            maskImage: "linear-gradient(140deg, transparent 35%, #000 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full"
          style={{
            backgroundImage: `radial-gradient(${RISO_PAPER} 1.4px, transparent 1.6px)`,
            backgroundSize: "5px 5px",
            opacity: 0.5,
          }}
        />

        <div
          className="z-10 flex items-center justify-between text-[10px] font-black tracking-widest uppercase"
          style={{ color: p.text }}
        >
          <span>{COLOR_NAME[color]}</span>
          <span
            className="border px-1 text-[9px]"
            style={{ borderColor: p.text }}
          >
            Riso
          </span>
        </div>

        <div className="z-10 my-auto self-center">
          <span
            className={`block leading-none font-black ${isAction(value) ? "text-[90px]" : "text-[120px]"}`}
            style={{ color: p.num, textShadow: `5px 4px 0 ${p.shadow}` }}
          >
            {glyph(value)}
          </span>
        </div>

        <div
          className="z-10 flex items-center justify-between text-[9px] font-bold uppercase"
          style={{ color: p.text }}
        >
          <span>{valueLabel(value)}</span>
          <span>{COLOR_NAME[color].toLowerCase()} ink</span>
        </div>
      </div>
      <div className="flex justify-between px-0.5 pt-1 text-[8px] text-[#1d1d1b]/50">
        <span>⊕</span>
        <span>SNS / LIMITED ED.</span>
        <span>⊕</span>
      </div>
    </div>
  );
}

function Wild({ value }: WildProps) {
  return (
    <div
      className={`${SKIN_ROOT} group justify-between rounded-sm border-2 border-[#1d1d1b] p-3.5 font-mono`}
      style={{ background: RISO_PAPER, boxShadow: "5px 6px 0 #1d1d1b" }}
    >
      <div className="z-10 flex items-center justify-between">
        <span className="text-[10px] font-black tracking-widest text-[#1d1d1b] uppercase">
          Overprint
        </span>
        <span className="bg-[#1d1d1b] px-1 text-[9px] font-bold text-[#f7f3ea]">
          WILD
        </span>
      </div>

      <div className="z-10 my-auto flex flex-col items-center gap-2">
        <div className="transition-transform duration-500 group-hover:rotate-45">
          <Overprint size="size-32" />
        </div>
        <span
          className="text-5xl leading-none font-black text-[#1d1d1b]"
          style={{ textShadow: "3px 2px 0 #f2464f" }}
        >
          {value === "wild_draw4" ? "+4" : "W"}
        </span>
      </div>

      <div className="z-10 flex items-center justify-between">
        <div className="flex gap-1">
          {SUITS.map((c) => (
            <span
              key={c}
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: RISO[c].ink }}
            />
          ))}
        </div>
        <span className="text-[9px] font-bold text-[#1d1d1b] uppercase">
          4 inks
        </span>
      </div>
    </div>
  );
}

function Back() {
  return (
    <div
      className={`${SKIN_ROOT} rounded-sm p-2 font-mono`}
      style={{ background: RISO_PAPER, boxShadow: "5px 6px 0 #1d1d1b" }}
    >
      <div
        className="relative flex flex-1 flex-col items-center justify-center gap-2 overflow-hidden"
        style={{
          backgroundColor: "#1d1d1b",
          backgroundImage: `radial-gradient(${RISO.red.ink} 1.6px, transparent 1.8px)`,
          backgroundSize: "7px 7px",
        }}
      >
        <Overprint size="size-24" />
        <span
          className="text-3xl font-black text-[#f7f3ea]"
          style={{ textShadow: "3px 2px 0 #f2464f" }}
        >
          SNS
        </span>
      </div>
      <div className="flex justify-between px-0.5 pt-1 text-[8px] text-[#1d1d1b]/50">
        <span>⊕</span>
        <span>PRINTED BY SNS</span>
        <span>⊕</span>
      </div>
    </div>
  );
}

export const RISO_SKIN: Skin = {
  id: "riso",
  label: "Risograph",
  subtitle: "One ink per color, paper margin, halftone",
  accent: "#f2464f",
  Face,
  Wild,
  Back,
};
