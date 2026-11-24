import {
  COLOR_NAME,
  SKIN_ROOT,
  SUITS,
  glyph,
  isAction,
  valueLabel,
  type ActionValue,
  type FaceProps,
  type Skin,
  type SuitColor,
  type WildProps,
} from "./common";

// Ukiyo-e: seigaiha waves in the color, a paper moon, the color as a kanji

const PAPER = "#f3e7cc";
const UKI: Record<
  SuitColor,
  { bg: string; deep: string; light: string; ink: string; kanji: string }
> = {
  red: {
    bg: "#c8372d",
    deep: "#8a2017",
    light: "#e3705c",
    ink: "#2a0d08",
    kanji: "赤",
  },
  yellow: {
    bg: "#e3a82a",
    deep: "#a87410",
    light: "#f6d27a",
    ink: "#3a2706",
    kanji: "黄",
  },
  green: {
    bg: "#3d8a59",
    deep: "#245c39",
    light: "#7fbf91",
    ink: "#0e2617",
    kanji: "緑",
  },
  blue: {
    bg: "#2b4d86",
    deep: "#182d52",
    light: "#6088c6",
    ink: "#0b1426",
    kanji: "青",
  },
};
const KANJI_NUM = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const KANJI_ACTION: Record<ActionValue, string> = {
  skip: "止",
  reverse: "逆",
  draw2: "弐",
};

const seigaiha = (c: string) =>
  `radial-gradient(circle at 50% 100%, transparent 30%, ${c} 31% 36%, transparent 37% 50%, ${c} 51% 56%, transparent 57% 70%, ${c} 71% 76%, transparent 77%)`;

const PANEL = `${SKIN_ROOT} justify-between border-2 p-3 font-serif`;

function Waves({ fill }: { fill: string }) {
  return (
    <svg
      className="pointer-events-none absolute bottom-0 left-0 h-28 w-full"
      viewBox="0 0 200 100"
      preserveAspectRatio="none"
    >
      <path
        d="M0 50 Q25 15 55 40 Q70 52 85 40 Q110 8 140 18 Q165 26 150 46 Q175 32 200 42 V100 H0Z"
        fill={fill}
      />
      <path
        d="M118 22 q10 -12 24 -4 M126 30 q8 -8 16 -2 M30 36 q8 -8 18 -2"
        stroke={PAPER}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="158" cy="44" r="2.5" fill={PAPER} />
      <circle cx="166" cy="38" r="2" fill={PAPER} />
    </svg>
  );
}

function Face({ color, value }: FaceProps) {
  const p = UKI[color];
  const kanjiValue = isAction(value)
    ? KANJI_ACTION[value]
    : KANJI_NUM[Number(value)];
  return (
    <div
      className={PANEL}
      style={{
        backgroundColor: p.bg,
        backgroundImage: `${seigaiha(p.light + "66")}, ${seigaiha(p.light + "66")}`,
        backgroundSize: "32px 16px, 32px 16px",
        backgroundPosition: "0 0, 16px 8px",
        borderColor: PAPER,
        boxShadow: `6px 6px 0 ${p.deep}`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-1.5 border"
        style={{ borderColor: PAPER + "80" }}
      />
      <Waves fill={p.deep} />

      <div className="z-10 flex items-start justify-between">
        <div
          className="flex h-10 w-10 -rotate-3 items-center justify-center rounded-sm text-xl font-black"
          style={{
            background: PAPER,
            color: p.bg,
            boxShadow: `2px 2px 0 ${p.deep}`,
          }}
        >
          {p.kanji}
        </div>
        <div
          className="text-[11px] font-bold tracking-[0.35em] [writing-mode:vertical-rl]"
          style={{ color: PAPER }}
        >
          {p.kanji}の札
        </div>
      </div>

      <div className="z-10 -mt-6 flex flex-col items-center">
        <div
          className={`flex h-28 w-28 items-center justify-center rounded-full font-black ${isAction(value) ? "text-5xl" : "text-6xl"}`}
          style={{
            background: PAPER,
            color: p.ink,
            boxShadow: `0 0 0 3px ${p.bg}, 0 0 0 5px ${PAPER}`,
          }}
        >
          {glyph(value)}
        </div>
        <span
          className="mt-2 text-sm font-bold tracking-[0.4em]"
          style={{ color: PAPER }}
        >
          {kanjiValue}
        </span>
      </div>

      <div
        className="z-10 flex items-end justify-between text-[9px] font-bold tracking-widest uppercase"
        style={{ color: PAPER }}
      >
        <span>{COLOR_NAME[color]}</span>
        <span>{valueLabel(value)}</span>
      </div>
    </div>
  );
}

function Wild({ value }: WildProps) {
  return (
    <div
      className={`${PANEL} group bg-[#15161c]`}
      style={{ borderColor: PAPER, boxShadow: "6px 6px 0 #000", color: PAPER }}
    >
      <div
        className="pointer-events-none absolute inset-1.5 border"
        style={{ borderColor: PAPER + "50" }}
      />
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center text-[190px] font-black"
        style={{ color: PAPER + "0f" }}
      >
        嵐
      </div>

      <div className="z-10 flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-[0.3em] uppercase">
          Wild
        </span>
        <span className="text-[11px] font-bold tracking-[0.3em]">四つの紋</span>
      </div>

      <div className="z-10 my-auto flex flex-col items-center gap-4">
        <div className="grid grid-cols-2 gap-3 transition-transform duration-700 group-hover:rotate-90">
          {SUITS.map((c) => (
            <span
              key={c}
              className="flex h-11 w-11 items-center justify-center rounded-full border-2"
              style={{ background: UKI[c].bg, borderColor: PAPER }}
            >
              <span
                className="h-4 w-4 rounded-full"
                style={{ background: PAPER }}
              />
            </span>
          ))}
        </div>
        <div
          className="-rotate-2 border bg-[#c8372d] px-3 py-1 text-3xl font-black"
          style={{ borderColor: PAPER }}
        >
          {value === "wild_draw4" ? "+4" : "変"}
        </div>
      </div>

      <div className="z-10 text-center text-[9px] tracking-[0.3em] uppercase opacity-70">
        Storm of the four clans
      </div>
    </div>
  );
}

function Back() {
  return (
    <div
      className={`${PANEL} items-center justify-center`}
      style={{
        backgroundColor: "#1d2a44",
        backgroundImage: `${seigaiha("#3b5585aa")}, ${seigaiha("#3b5585aa")}`,
        backgroundSize: "32px 16px, 32px 16px",
        backgroundPosition: "0 0, 16px 8px",
        borderColor: PAPER,
        boxShadow: "6px 6px 0 #0b1426",
      }}
    >
      <div
        className="pointer-events-none absolute inset-1.5 border"
        style={{ borderColor: PAPER + "80" }}
      />
      <div
        className="z-10 flex h-28 w-28 items-center justify-center rounded-full text-5xl font-black"
        style={{
          background: PAPER,
          color: "#c8372d",
          boxShadow: `0 0 0 3px #1d2a44, 0 0 0 5px ${PAPER}`,
        }}
      >
        札
      </div>
      <span
        className="z-10 mt-3 text-xs font-bold tracking-[0.4em]"
        style={{ color: PAPER }}
      >
        SNS
      </span>
    </div>
  );
}

export const UKIYOE_SKIN: Skin = {
  id: "ukiyoe",
  label: "Ukiyo-e",
  subtitle: "Seigaiha waves, paper moon, color kanji",
  accent: "#e3705c",
  Face,
  Wild,
  Back,
};
