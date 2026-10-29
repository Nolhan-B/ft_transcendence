import React, { useState } from "react";

/* ================================================================== */
/* MODÈLE DE CARTE                                                     */
/* ================================================================== */
type UnoColor = "red" | "yellow" | "green" | "blue";
type ActionValue = "skip" | "reverse" | "+2";
type CardValue =
  "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | ActionValue;
type WildValue = "wild" | "+4";

type CardProps = { color: UnoColor; value: CardValue };
type WildProps = { value: WildValue };

const COLORS: UnoColor[] = ["red", "yellow", "green", "blue"];
const VALUES: CardValue[] = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "skip",
  "reverse",
  "+2",
];

const COLOR_NAME: Record<UnoColor, string> = {
  red: "Rouge",
  yellow: "Jaune",
  green: "Vert",
  blue: "Bleu",
};
const ACTION_NAME: Record<ActionValue, string> = {
  skip: "Passe",
  reverse: "Inversion",
  "+2": "Pioche 2",
};

const isAction = (v: CardValue): v is ActionValue =>
  v === "skip" || v === "reverse" || v === "+2";
const glyph = (v: CardValue) =>
  v === "skip" ? "⊘" : v === "reverse" ? "⇄" : v;
const valueLabel = (v: CardValue) => (isAction(v) ? ACTION_NAME[v] : `N°${v}`);

/* Base commune à toutes les cartes (format 56 × 84) */
const CARD_BASE =
  "w-56 h-84 shrink-0 relative overflow-hidden flex flex-col cursor-pointer select-none transition-transform duration-200 hover:-translate-y-2";

/* ================================================================== */
/* 1. GAME BOY — la coque EST la couleur                               */
/* ================================================================== */
const PX_DIGITS: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
};
const PX_PLUS = ["00000", "00100", "00100", "11111", "00100", "00100", "00000"];
const PX_SKIP = [
  "0011100",
  "0100010",
  "1000101",
  "1001001",
  "1010001",
  "0100010",
  "0011100",
];
const PX_REV = [
  "001000000",
  "011111110",
  "001000010",
  "000000010",
  "010000000",
  "010000100",
  "011111110",
  "000000100",
];
const PX_ROW_COLORS = ["r", "r", "y", "y", "b", "b", "b"];
const PX_PLUS4 = PX_PLUS.map(
  (row, i) =>
    row.replace(/1/g, "g") +
    "0" +
    PX_DIGITS["4"][i].replace(/1/g, PX_ROW_COLORS[i]),
);
const PX_DIAMOND = [
  "000ry000",
  "00rryy00",
  "0rrryyy0",
  "rrrryyyy",
  "ggggbbbb",
  "0gggbbb0",
  "00ggbb00",
  "000gb000",
];
const PX_WILD_PALETTE = {
  r: "#e8323c",
  y: "#f2b705",
  g: "#2fa84f",
  b: "#2f6fdb",
};

function gbSprite(v: CardValue): { rows: string[]; size: number } {
  if (v === "skip") return { rows: PX_SKIP, size: 8 };
  if (v === "reverse") return { rows: PX_REV, size: 6 };
  if (v === "+2")
    return {
      rows: PX_PLUS.map((r, i) => r + "0" + PX_DIGITS["2"][i]),
      size: 6,
    };
  return { rows: PX_DIGITS[v], size: 9 };
}

function PixelSprite({
  rows,
  palette,
  size = 6,
}: {
  rows: string[];
  palette: Record<string, string>;
  size?: number;
}) {
  return (
    <div className="flex flex-col">
      {rows.map((row, y) => (
        <div key={y} className="flex">
          {row.split("").map((c, x) => (
            <div
              key={x}
              style={{
                width: size,
                height: size,
                background: c === "0" ? "transparent" : palette[c],
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

const GB: Record<
  UnoColor,
  { shell: string; dark: string; screen: string; ink: string; text: string }
> = {
  red: {
    shell: "#d7303b",
    dark: "#9e1d27",
    screen: "#ffd9d3",
    ink: "#7a1016",
    text: "#ffffff",
  },
  yellow: {
    shell: "#f7c81c",
    dark: "#bf9200",
    screen: "#fff4bf",
    ink: "#5c4600",
    text: "#3a2c00",
  },
  green: {
    shell: "#3fa63a",
    dark: "#27762a",
    screen: "#c6e98c",
    ink: "#0f380f",
    text: "#ffffff",
  },
  blue: {
    shell: "#2f6fdb",
    dark: "#1c4ea6",
    screen: "#d3e4ff",
    ink: "#0b2a6b",
    text: "#ffffff",
  },
};

function GbControls() {
  return (
    <div className="flex items-center justify-between mt-auto px-1 pb-2 z-10">
      <div className="relative w-12 h-12">
        <div className="absolute top-1/2 -translate-y-1/2 w-12 h-4 bg-[#1c1c1c] rounded-sm" />
        <div className="absolute left-1/2 -translate-x-1/2 h-12 w-4 bg-[#1c1c1c] rounded-sm" />
      </div>
      <div className="flex items-end gap-2 -rotate-[25deg]">
        {["B", "A"].map((l, i) => (
          <span
            key={l}
            className={`w-7 h-7 rounded-full bg-[#1c1c1c] text-[9px] text-white/80 font-black flex items-center justify-center shadow-[inset_-2px_-2px_0_rgba(255,255,255,0.15)] ${i === 1 ? "mb-3" : ""}`}
          >
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

function GameBoyCard({ color, value }: CardProps) {
  const p = GB[color];
  const { rows, size } = gbSprite(value);
  return (
    <div
      className={`${CARD_BASE} rounded-lg rounded-br-[44px] border-2 p-3 gap-2 font-mono`}
      style={{
        background: p.shell,
        borderColor: p.dark,
        boxShadow: `inset -4px -4px 0 ${p.dark}, 6px 6px 0 #0d0d10`,
      }}
    >
      <div className="bg-[#34343f] rounded-md rounded-br-[22px] p-2.5 pb-3 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[7px] text-[#c4c3bc] tracking-widest">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_4px_#ef4444]" />
            BATTERY
          </span>
          <span>DOT MATRIX</span>
        </div>
        <div
          className="h-36 p-2 flex flex-col justify-between"
          style={{ background: p.screen }}
        >
          <div
            className="flex justify-between text-[8px] font-black uppercase"
            style={{ color: p.ink }}
          >
            <span>{COLOR_NAME[color]}</span>
            <span>{isAction(value) ? ACTION_NAME[value] : `LV ${value}`}</span>
          </div>
          <div className="mx-auto">
            <PixelSprite rows={rows} palette={{ "1": p.ink }} size={size} />
          </div>
          <div
            className="text-[8px] font-black text-center animate-pulse"
            style={{ color: p.ink, opacity: 0.7 }}
          >
            ▶ PRESS A
          </div>
        </div>
      </div>

      <div
        className="flex items-baseline justify-between px-1"
        style={{ color: p.text }}
      >
        <span className="text-[13px] font-black italic tracking-tight">
          GAME UNO
        </span>
        <span className="text-[9px] font-black uppercase tracking-widest">
          {COLOR_NAME[color]}
        </span>
      </div>

      <GbControls />
    </div>
  );
}

function GameBoyWild({ value }: WildProps) {
  return (
    <div
      className={`${CARD_BASE} rounded-lg rounded-br-[44px] border-2 border-[#0d0d10] bg-[#26262e] p-3 gap-2 font-mono shadow-[inset_-4px_-4px_0_#15151a,6px_6px_0_#0d0d10]`}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(115deg, transparent 0 58%, #e8323c 58% 63%, #f2b705 63% 68%, #2fa84f 68% 73%, #2f6fdb 73% 78%, transparent 78%)",
        }}
      />
      <div className="bg-[#111116] rounded-md rounded-br-[22px] p-2.5 pb-3 flex flex-col gap-1.5 z-10">
        <div className="flex items-center justify-between text-[7px] text-[#c4c3bc] tracking-widest">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_#34d399]" />
            POWER
          </span>
          <span>COLOR</span>
        </div>
        <div className="h-36 bg-[#f4f4ee] p-2 flex flex-col justify-between">
          <div className="flex justify-between text-[8px] font-black text-[#26262e]">
            <span>JOKER</span>
            <span>{value === "+4" ? "BOSS +4" : "WILD"}</span>
          </div>
          <div className="mx-auto">
            <PixelSprite
              rows={value === "+4" ? PX_PLUS4 : PX_DIAMOND}
              palette={PX_WILD_PALETTE}
              size={7}
            />
          </div>
          <div className="flex justify-center gap-1">
            {Object.values(PX_WILD_PALETTE).map((c) => (
              <span key={c} className="w-3 h-3" style={{ background: c }} />
            ))}
          </div>
        </div>
      </div>

      <div className="text-[13px] font-black italic text-white tracking-tight px-1 z-10">
        GAME UNO <span className="text-[#e8323c]">C</span>
        <span className="text-[#f2b705]">O</span>
        <span className="text-[#2fa84f]">L</span>
        <span className="text-[#5b93ef]">O</span>
        <span className="text-[#e8323c]">R</span>
      </div>

      <GbControls />
    </div>
  );
}

/* ================================================================== */
/* 2. WIN95 × VAPORWAVE — barre de titre + écran teintés               */
/* ================================================================== */
const BEVEL_OUT =
  "border-t-white border-l-white border-r-[#404040] border-b-[#404040]";
const BEVEL_IN =
  "border-t-[#404040] border-l-[#404040] border-r-white border-b-white";

const W95: Record<
  UnoColor,
  {
    title: [string, string];
    sky: [string, string];
    floor: string;
    grid: string;
    deep: string;
  }
> = {
  red: {
    title: ["#7a0010", "#e2364a"],
    sky: ["#ffb3bd", "#e2364a"],
    floor: "#4d000b",
    grid: "#ff7a8c",
    deep: "#5c0010",
  },
  yellow: {
    title: ["#7a5a00", "#e0aa00"],
    sky: ["#fff6b0", "#f5c400"],
    floor: "#5c4400",
    grid: "#ffe066",
    deep: "#6b4f00",
  },
  green: {
    title: ["#004a1c", "#1fae5a"],
    sky: ["#b8f5cf", "#1fae5a"],
    floor: "#003314",
    grid: "#6ee79a",
    deep: "#004a1c",
  },
  blue: {
    title: ["#000080", "#1084d0"],
    sky: ["#b8dcff", "#1f6fe0"],
    floor: "#001552",
    grid: "#6fb2ff",
    deep: "#001a66",
  },
};

function Win95TitleBar({
  background,
  title,
  swatch,
}: {
  background: string;
  title: string;
  swatch?: string;
}) {
  return (
    <div
      className="text-white text-[11px] font-bold px-1.5 py-0.5 flex items-center justify-between"
      style={{ background }}
    >
      <span className="flex items-center gap-1 truncate">
        {swatch && (
          <span
            className="w-3 h-3 border border-black shrink-0"
            style={{ background: swatch }}
          />
        )}
        {title}
      </span>
      <div className="flex gap-0.5 shrink-0">
        {["_", "□", "×"].map((b) => (
          <span
            key={b}
            className={`w-4 h-3.5 bg-[#c0c0c0] text-black text-[9px] leading-none flex items-center justify-center border ${BEVEL_OUT}`}
          >
            {b}
          </span>
        ))}
      </div>
    </div>
  );
}

function Win95Card({ color, value }: CardProps) {
  const p = W95[color];
  const slug = value === "+2" ? "plus2" : value;
  return (
    <div
      className={`${CARD_BASE} bg-[#c0c0c0] border-2 ${BEVEL_OUT} p-1 font-sans`}
      style={{ boxShadow: `8px 8px 0 ${p.title[1]}` }}
    >
      <Win95TitleBar
        background={`linear-gradient(90deg, ${p.title[0]}, ${p.title[1]})`}
        title={`${COLOR_NAME[color].toLowerCase()}_${slug}.exe`}
        swatch={p.sky[1]}
      />
      <div className="flex gap-2 text-[10px] text-black px-1 py-0.5">
        <span>
          <u>F</u>ichier
        </span>
        <span>
          <u>É</u>dition
        </span>
        <span>
          <u>?</u>
        </span>
      </div>

      <div
        className={`flex-1 m-1 border-2 ${BEVEL_IN} relative overflow-hidden`}
        style={{ background: `linear-gradient(${p.sky[0]}, ${p.sky[1]})` }}
      >
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-14 w-28 h-28 rounded-full"
          style={{
            background:
              "repeating-linear-gradient(to bottom, rgba(255,255,255,0.85) 0 9px, transparent 9px 13px)",
          }}
        />
        <div
          className="absolute bottom-0 inset-x-0 h-20"
          style={{
            backgroundImage: `linear-gradient(${p.grid} 1px, transparent 1px), linear-gradient(90deg, ${p.grid} 1px, transparent 1px)`,
            backgroundSize: "16px 12px",
            backgroundColor: p.floor,
            transform: "perspective(120px) rotateX(45deg)",
            transformOrigin: "bottom",
          }}
        />
        {isAction(value) && (
          <span
            className={`absolute top-1 left-1 z-10 bg-[#c0c0c0] text-black text-[9px] font-bold px-1 border ${BEVEL_OUT}`}
          >
            {ACTION_NAME[value]}
          </span>
        )}
        <div
          className={`absolute inset-0 flex items-center justify-center font-black italic text-white ${isAction(value) ? "text-7xl" : "text-8xl"}`}
          style={{ textShadow: `3px 3px 0 ${p.deep}, 6px 6px 0 #000` }}
        >
          {glyph(value)}
        </div>
      </div>

      <div className="flex gap-1 text-[9px] text-black">
        <span
          className={`flex-1 border ${BEVEL_IN} px-1 flex items-center gap-1 font-bold uppercase`}
        >
          <span
            className="w-2 h-2 border border-black"
            style={{ background: p.sky[1] }}
          />
          {COLOR_NAME[color]}
        </span>
        <span className={`border ${BEVEL_IN} px-1`}>{valueLabel(value)}</span>
      </div>
    </div>
  );
}

function Win95Wild({ value }: WildProps) {
  return (
    <div
      className={`${CARD_BASE} bg-[#c0c0c0] border-2 ${BEVEL_OUT} p-1 font-sans shadow-[8px_8px_0_#111]`}
    >
      <Win95TitleBar
        background="linear-gradient(90deg, #e2364a, #e0aa00, #1fae5a, #1f6fe0)"
        title={`joker_${value === "+4" ? "plus4" : "wild"}.exe`}
      />
      <div className="flex gap-2 text-[10px] text-black px-1 py-0.5">
        <span>
          <u>F</u>ichier
        </span>
        <span>
          <u>C</u>ouleur
        </span>
      </div>

      <div
        className={`flex-1 m-1 border-2 ${BEVEL_IN} relative overflow-hidden bg-[#14101f] flex flex-col items-center justify-center gap-3`}
      >
        <div
          className="absolute inset-0 opacity-60 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(#fff 0.6px, transparent 0.8px)",
            backgroundSize: "18px 22px",
          }}
        />
        <div className="grid grid-cols-2 gap-1 -skew-y-6 z-10">
          <span className="w-9 h-9 bg-[#e2364a]" />
          <span className="w-9 h-9 bg-[#1fae5a]" />
          <span className="w-9 h-9 bg-[#1f6fe0]" />
          <span className="w-9 h-9 bg-[#f5c400]" />
        </div>
        <span
          className={`z-10 font-black italic text-white ${value === "+4" ? "text-6xl" : "text-3xl"}`}
          style={{ textShadow: "3px 3px 0 #000" }}
        >
          {value === "+4" ? "+4" : "JOKER"}
        </span>
      </div>

      <div className="px-1 pb-1">
        <p className="text-[9px] text-black mb-0.5">Choisissez une couleur…</p>
        <div
          className={`h-4 bg-white border-2 ${BEVEL_IN} p-[2px] flex gap-[2px]`}
        >
          <span className="flex-1 bg-[#e2364a]" />
          <span className="flex-1 bg-[#f5c400]" />
          <span className="flex-1 bg-[#1fae5a]" />
          <span className="flex-1 bg-[#1f6fe0] animate-pulse" />
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* 3. UKIYO-E — fond seigaiha dans la couleur, lune de papier          */
/* ================================================================== */
const PAPER = "#f3e7cc";
const UKI: Record<
  UnoColor,
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
  "+2": "弐",
};

const seigaiha = (c: string) =>
  `radial-gradient(circle at 50% 100%, transparent 30%, ${c} 31% 36%, transparent 37% 50%, ${c} 51% 56%, transparent 57% 70%, ${c} 71% 76%, transparent 77%)`;

function UkiyoCard({ color, value }: CardProps) {
  const p = UKI[color];
  const kanjiValue = isAction(value)
    ? KANJI_ACTION[value]
    : KANJI_NUM[Number(value)];
  return (
    <div
      className={`${CARD_BASE} justify-between p-3 border-2 font-serif`}
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
        className="absolute inset-1.5 border pointer-events-none"
        style={{ borderColor: PAPER + "80" }}
      />
      <svg
        className="absolute bottom-0 left-0 w-full h-28 pointer-events-none"
        viewBox="0 0 200 100"
        preserveAspectRatio="none"
      >
        <path
          d="M0 50 Q25 15 55 40 Q70 52 85 40 Q110 8 140 18 Q165 26 150 46 Q175 32 200 42 V100 H0Z"
          fill={p.deep}
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

      <div className="flex justify-between items-start z-10">
        <div
          className="w-10 h-10 flex items-center justify-center text-xl font-black rounded-sm -rotate-3"
          style={{
            background: PAPER,
            color: p.bg,
            boxShadow: `2px 2px 0 ${p.deep}`,
          }}
        >
          {p.kanji}
        </div>
        <div
          className="[writing-mode:vertical-rl] text-[11px] font-bold tracking-[0.35em]"
          style={{ color: PAPER }}
        >
          {p.kanji}の札
        </div>
      </div>

      <div className="z-10 flex flex-col items-center -mt-6">
        <div
          className={`w-28 h-28 rounded-full flex items-center justify-center font-black ${isAction(value) ? "text-5xl" : "text-6xl"}`}
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
        className="z-10 flex justify-between items-end text-[9px] tracking-widest uppercase font-bold"
        style={{ color: PAPER }}
      >
        <span>{COLOR_NAME[color]}</span>
        <span>{valueLabel(value)}</span>
      </div>
    </div>
  );
}

function UkiyoWild({ value }: WildProps) {
  return (
    <div
      className={`${CARD_BASE} justify-between p-3 border-2 font-serif bg-[#15161c] group`}
      style={{ borderColor: PAPER, boxShadow: "6px 6px 0 #000", color: PAPER }}
    >
      <div
        className="absolute inset-1.5 border pointer-events-none"
        style={{ borderColor: PAPER + "50" }}
      />
      <div
        className="absolute inset-0 flex items-center justify-center text-[190px] font-black pointer-events-none"
        style={{ color: PAPER + "0f" }}
      >
        嵐
      </div>

      <div className="flex justify-between items-center z-10">
        <span className="text-[10px] font-bold uppercase tracking-[0.3em]">
          Joker
        </span>
        <span className="text-[11px] font-bold tracking-[0.3em]">四つの紋</span>
      </div>

      <div className="my-auto flex flex-col items-center gap-4 z-10">
        <div className="grid grid-cols-2 gap-3 transition-transform duration-700 group-hover:rotate-90">
          {COLORS.map((c) => (
            <span
              key={c}
              className="w-11 h-11 rounded-full border-2 flex items-center justify-center"
              style={{ background: UKI[c].bg, borderColor: PAPER }}
            >
              <span
                className="w-4 h-4 rounded-full"
                style={{ background: PAPER }}
              />
            </span>
          ))}
        </div>
        <div
          className="bg-[#c8372d] px-3 py-1 text-3xl font-black -rotate-2 border"
          style={{ borderColor: PAPER }}
        >
          {value === "+4" ? "+4" : "変"}
        </div>
      </div>

      <div className="z-10 text-center text-[9px] uppercase tracking-[0.3em] opacity-70">
        Tempête des quatre clans
      </div>
    </div>
  );
}

/* ================================================================== */
/* 4. RISOGRAPH — aplat d'encre pleine dans la couleur                 */
/* ================================================================== */
const RISO_PAPER = "#f7f3ea";
const RISO: Record<
  UnoColor,
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

function RisoCard({ color, value }: CardProps) {
  const p = RISO[color];
  return (
    <div
      className={`${CARD_BASE} p-2 rounded-sm font-mono hover:-rotate-1`}
      style={{ background: RISO_PAPER, boxShadow: `5px 6px 0 ${p.dot}` }}
    >
      <div
        className="relative flex-1 p-3 flex flex-col justify-between overflow-hidden"
        style={{ background: p.ink, transform: "translate(1px, -1px)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(${p.dot} 1.6px, transparent 1.8px)`,
            backgroundSize: "6px 6px",
            WebkitMaskImage:
              "linear-gradient(140deg, transparent 35%, #000 100%)",
            maskImage: "linear-gradient(140deg, transparent 35%, #000 100%)",
          }}
        />
        <div
          className="absolute -top-8 -right-8 w-28 h-28 rounded-full pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(${RISO_PAPER} 1.4px, transparent 1.6px)`,
            backgroundSize: "5px 5px",
            opacity: 0.5,
          }}
        />

        <div
          className="flex justify-between items-center z-10 text-[10px] font-black uppercase tracking-widest"
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

        <div className="my-auto self-center z-10">
          <span
            className={`block leading-none font-black ${isAction(value) ? "text-[90px]" : "text-[120px]"}`}
            style={{ color: p.num, textShadow: `5px 4px 0 ${p.shadow}` }}
          >
            {glyph(value)}
          </span>
        </div>

        <div
          className="flex justify-between items-center z-10 text-[9px] font-bold uppercase"
          style={{ color: p.text }}
        >
          <span>{valueLabel(value)}</span>
          <span>Encre {COLOR_NAME[color].toLowerCase()}</span>
        </div>
      </div>
      <div className="flex justify-between text-[8px] text-[#1d1d1b]/50 px-0.5 pt-1">
        <span>⊕</span>
        <span>UNO / ÉD. LIMITÉE</span>
        <span>⊕</span>
      </div>
    </div>
  );
}

function RisoWild({ value }: WildProps) {
  return (
    <div
      className={`${CARD_BASE} p-3.5 justify-between rounded-sm font-mono border-2 border-[#1d1d1b] group`}
      style={{ background: RISO_PAPER, boxShadow: "5px 6px 0 #1d1d1b" }}
    >
      <div className="flex justify-between items-center z-10">
        <span className="text-[10px] font-black uppercase tracking-widest text-[#1d1d1b]">
          Overprint
        </span>
        <span className="text-[9px] font-bold bg-[#1d1d1b] text-[#f7f3ea] px-1">
          JOKER
        </span>
      </div>

      <div className="my-auto flex flex-col items-center gap-2 z-10">
        <div className="relative w-32 h-32 transition-transform duration-500 group-hover:rotate-45">
          <div
            className="absolute top-0 left-0 w-20 h-20 rounded-full mix-blend-multiply"
            style={{ background: RISO.red.ink }}
          />
          <div
            className="absolute top-0 right-0 w-20 h-20 rounded-full mix-blend-multiply"
            style={{ background: RISO.yellow.ink }}
          />
          <div
            className="absolute bottom-0 left-0 w-20 h-20 rounded-full mix-blend-multiply"
            style={{ background: RISO.green.ink }}
          />
          <div
            className="absolute bottom-0 right-0 w-20 h-20 rounded-full mix-blend-multiply"
            style={{ background: RISO.blue.ink }}
          />
        </div>
        <span
          className="text-5xl font-black leading-none text-[#1d1d1b]"
          style={{ textShadow: "3px 2px 0 #f2464f" }}
        >
          {value === "+4" ? "+4" : "W"}
        </span>
      </div>

      <div className="flex justify-between items-center z-10">
        <div className="flex gap-1">
          {COLORS.map((c) => (
            <span
              key={c}
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: RISO[c].ink }}
            />
          ))}
        </div>
        <span className="text-[9px] font-bold uppercase text-[#1d1d1b]">
          4 encres
        </span>
      </div>
    </div>
  );
}

/* ================================================================== */
/* 5. ART DÉCO — laque précieuse dans la couleur                       */
/* ================================================================== */
const DECO: Record<
  UnoColor,
  { bg: string; bright: string; orn: string; gem: string }
> = {
  red: { bg: "#8c0d22", bright: "#d42a45", orn: "#e8c766", gem: "Rubis" },
  yellow: { bg: "#d99e00", bright: "#ffd34d", orn: "#1a1405", gem: "Topaze" },
  green: { bg: "#0c5e3c", bright: "#1fa36a", orn: "#e8c766", gem: "Émeraude" },
  blue: { bg: "#0f3474", bright: "#2a64c4", orn: "#e8c766", gem: "Saphir" },
};
const CORNERS = [
  "top-1 left-1",
  "top-1 right-1",
  "bottom-1 left-1",
  "bottom-1 right-1",
];

function DecoCard({ color, value }: CardProps) {
  const p = DECO[color];
  return (
    <div
      className={`${CARD_BASE} justify-between p-3 border-2 font-serif hover:shadow-[0_0_30px_rgba(232,199,102,0.45)]`}
      style={{
        borderColor: p.orn,
        background: `radial-gradient(circle at 50% 115%, ${p.bright}, ${p.bg} 70%)`,
        color: p.orn,
      }}
    >
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          background: `repeating-conic-gradient(from -90deg at 50% 110%, ${p.orn} 0deg 1.5deg, transparent 1.5deg 9deg)`,
        }}
      />
      <div
        className="absolute inset-2 border pointer-events-none"
        style={{ borderColor: p.orn + "99" }}
      />
      {CORNERS.map((pos) => (
        <span
          key={pos}
          className={`absolute ${pos} w-2.5 h-2.5 rotate-45 pointer-events-none`}
          style={{ background: p.orn }}
        />
      ))}

      <div className="text-center z-10 pt-2">
        <span className="text-[9px] tracking-[0.5em] uppercase">
          ◆ {p.gem} ◆
        </span>
      </div>

      <div className="my-auto flex flex-col items-center z-10">
        <span
          className={`leading-none font-light ${isAction(value) ? "text-[80px]" : "text-[110px]"}`}
        >
          {glyph(value)}
        </span>
        <div className="flex items-center gap-2 mt-2">
          <span className="w-8 h-px" style={{ background: p.orn }} />
          <span
            className="w-1.5 h-1.5 rotate-45"
            style={{ background: p.orn }}
          />
          <span className="w-8 h-px" style={{ background: p.orn }} />
        </div>
        <span className="text-[11px] tracking-[0.4em] uppercase mt-2 font-bold">
          {COLOR_NAME[color]}
        </span>
      </div>

      <div className="text-center text-[9px] tracking-[0.4em] uppercase z-10 pb-2 opacity-80">
        {valueLabel(value)}
      </div>
    </div>
  );
}

function DecoWild({ value }: WildProps) {
  return (
    <div
      className={`${CARD_BASE} bg-[#0b0b0b] border-2 border-[#e8c766] p-3 font-serif hover:shadow-[0_0_35px_rgba(232,199,102,0.6)] group`}
    >
      <div
        className="absolute -bottom-36 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full pointer-events-none transition-transform duration-700 group-hover:scale-110"
        style={{
          background: `conic-gradient(from -90deg, ${DECO.red.bright} 0deg 45deg, ${DECO.yellow.bright} 45deg 90deg, ${DECO.green.bright} 90deg 135deg, ${DECO.blue.bright} 135deg 180deg, transparent 180deg)`,
        }}
      />
      <div
        className="absolute -bottom-36 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full pointer-events-none"
        style={{
          background:
            "repeating-conic-gradient(from -90deg, #0b0b0b 0deg 1.2deg, transparent 1.2deg 11.25deg)",
        }}
      />
      <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full bg-[#0b0b0b] border-2 border-[#e8c766] pointer-events-none" />
      <div className="absolute inset-2 border border-[#e8c766]/60 pointer-events-none" />

      <div className="text-center z-10 pt-2">
        <span className="text-[9px] tracking-[0.5em] text-[#e8c766] uppercase">
          ◆ Joker ◆
        </span>
      </div>
      <div className="flex flex-col items-center z-10 mt-6">
        <span
          className={`font-light text-transparent bg-clip-text bg-gradient-to-b from-[#f5e6a8] via-[#e8c766] to-[#8a6d1d] ${value === "+4" ? "text-7xl" : "text-5xl"}`}
        >
          {value === "+4" ? "+4" : "BAL"}
        </span>
        <span className="text-xs tracking-[0.4em] text-[#e9d9a6] uppercase mt-2">
          Le Grand Bal
        </span>
      </div>
    </div>
  );
}

/* ================================================================== */
/* 6. POP ART — trame Ben-Day pleine dans la couleur                   */
/* ================================================================== */
const POP: Record<UnoColor, { bg: string; dot: string }> = {
  red: { bg: "#ff4d5e", dot: "#c4001f" },
  yellow: { bg: "#ffe14d", dot: "#f0b400" },
  green: { bg: "#36c96a", dot: "#08933a" },
  blue: { bg: "#3d8bff", dot: "#0b4fc2" },
};
const BURST =
  "polygon(50% 0%, 61% 18%, 79% 9%, 76% 30%, 98% 32%, 82% 47%, 98% 65%, 76% 68%, 80% 91%, 61% 80%, 50% 100%, 39% 80%, 20% 91%, 24% 68%, 2% 65%, 18% 47%, 2% 32%, 24% 30%, 21% 9%, 39% 18%)";
const POP_NUM_WORDS = ["POW!", "WHAM!", "BAM!", "ZAP!"];
const POP_ACTION_WORDS: Record<ActionValue, string> = {
  skip: "STOP!",
  reverse: "ZWOOSH!",
  "+2": "GULP!",
};
const POP_CAPTION: Record<ActionValue, string> = {
  skip: "Halte-là !",
  reverse: "Demi-tour !",
  "+2": "Pas de chance…",
};
const COMIC_STROKE: React.CSSProperties = {
  WebkitTextStroke: "4px #000",
  paintOrder: "stroke fill",
  textShadow: "6px 6px 0 #000",
};

function PopCard({ color, value }: CardProps) {
  const p = POP[color];
  const word = isAction(value)
    ? POP_ACTION_WORDS[value]
    : POP_NUM_WORDS[Number(value) % 4];
  return (
    <div
      className={`${CARD_BASE} justify-between border-4 border-black p-3 font-sans shadow-[8px_8px_0_#000] hover:rotate-2`}
      style={{
        backgroundColor: p.bg,
        backgroundImage: `radial-gradient(${p.dot} 2px, transparent 2.2px)`,
        backgroundSize: "9px 9px",
      }}
    >
      <div
        className="absolute -top-1 -right-4 w-32 h-28 bg-black rotate-12 z-10"
        style={{ clipPath: BURST }}
      >
        <div
          className="absolute inset-[6px] bg-white flex items-center justify-center"
          style={{ clipPath: BURST }}
        >
          <span className="text-base font-black italic text-black -rotate-6">
            {word}
          </span>
        </div>
      </div>

      <span className="z-20 self-start bg-[#fffbe0] border-2 border-black text-[10px] font-black uppercase px-1.5 py-0.5">
        {isAction(value) ? POP_CAPTION[value] : "Soudain…"}
      </span>

      <div className="my-auto text-center z-10">
        <span
          className={`leading-none font-black italic text-white ${isAction(value) ? "text-[96px]" : "text-[130px]"}`}
          style={COMIC_STROKE}
        >
          {glyph(value)}
        </span>
      </div>

      <div className="z-10 bg-white border-2 border-black px-2 py-1 text-[10px] font-black uppercase flex justify-between items-center">
        <span className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-full border-2 border-black"
            style={{ background: p.bg }}
          />
          {COLOR_NAME[color]}
        </span>
        <span>{valueLabel(value)}</span>
      </div>
    </div>
  );
}

function PopWild({ value }: WildProps) {
  return (
    <div
      className={`${CARD_BASE} border-4 border-black bg-black font-sans shadow-[8px_8px_0_#000] group`}
    >
      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-1">
        {COLORS.map((c) => (
          <div
            key={c}
            style={{
              backgroundColor: POP[c].bg,
              backgroundImage: `radial-gradient(${POP[c].dot} 2px, transparent 2.2px)`,
              backgroundSize: "8px 8px",
            }}
          />
        ))}
      </div>

      <span className="absolute top-2 left-2 z-20 bg-[#fffbe0] border-2 border-black text-[10px] font-black uppercase px-1.5 py-0.5">
        Joker !
      </span>

      <div
        className="absolute inset-0 m-auto w-48 h-48 bg-black z-10 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12"
        style={{ clipPath: BURST }}
      >
        <div
          className="absolute inset-[8px] bg-white flex flex-col items-center justify-center"
          style={{ clipPath: BURST }}
        >
          <span className="text-xs font-black italic text-black">KA-BOOM!</span>
          <span
            className={`font-black italic text-white ${value === "+4" ? "text-5xl" : "text-3xl"}`}
            style={{
              ...COMIC_STROKE,
              WebkitTextStroke: "3px #000",
              textShadow: "3px 3px 0 #000",
            }}
          >
            {value === "+4" ? "+4" : "WILD"}
          </span>
        </div>
      </div>

      <div className="absolute bottom-2 inset-x-2 z-20 bg-white border-2 border-black px-2 py-1 text-[10px] font-black uppercase text-center">
        Choisis ta couleur
      </div>
    </div>
  );
}

/* ================================================================== */
/* 7. PAPIER DÉCOUPÉ — paysage monochrome dans la couleur              */
/* ================================================================== */
/* [ciel, soleil, colline arrière, colline milieu, colline avant] */
const PAPERCUT: Record<UnoColor, [string, string, string, string, string]> = {
  red: ["#ffe1e1", "#ffb3b3", "#f25c5c", "#d62b3a", "#8f1424"],
  yellow: ["#fff8d6", "#ffe680", "#ffd23f", "#f2b705", "#a87400"],
  green: ["#e3f7e6", "#a9e8b4", "#4cc46b", "#20994a", "#0d5e2b"],
  blue: ["#e2efff", "#a9cdff", "#4f95f0", "#1f62cf", "#0d3687"],
};

function PaperLayer({
  d,
  fill,
  height,
  shadow = 0.25,
  className = "",
}: {
  d: string;
  fill: string;
  height: number;
  shadow?: number;
  className?: string;
}) {
  return (
    <svg
      className={`absolute bottom-0 left-0 w-full pointer-events-none ${className}`}
      style={{
        height,
        filter: `drop-shadow(0 -4px 6px rgba(0,0,0,${shadow}))`,
      }}
      viewBox="0 0 200 160"
      preserveAspectRatio="none"
    >
      <path d={d} fill={fill} />
    </svg>
  );
}

function PapercutCard({ color, value }: CardProps) {
  const p = PAPERCUT[color];
  return (
    <div
      className={`${CARD_BASE} justify-between p-3.5 rounded-xl font-sans shadow-[0_10px_25px_-8px_rgba(0,0,0,0.5)] group`}
      style={{ background: p[0] }}
    >
      <div
        className="absolute top-12 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full transition-transform duration-700 group-hover:translate-y-3"
        style={{ background: p[1], boxShadow: "0 4px 10px rgba(0,0,0,0.15)" }}
      />
      <PaperLayer
        d="M0 60 Q50 20 100 55 T200 40 V160 H0Z"
        fill={p[2]}
        height={170}
      />
      <PaperLayer
        d="M0 70 Q60 30 120 65 T200 55 V160 H0Z"
        fill={p[3]}
        height={124}
      />
      <PaperLayer
        d="M0 80 Q40 50 90 75 T200 70 V160 H0Z"
        fill={p[4]}
        height={80}
        shadow={0.3}
      />

      <span
        className="z-10 self-start bg-white text-[10px] font-black tracking-widest uppercase px-2 py-0.5 rounded shadow-[0_2px_4px_rgba(0,0,0,0.2)]"
        style={{ color: p[4] }}
      >
        {COLOR_NAME[color]}
      </span>

      <div className="z-10 text-center -mt-16">
        <span
          className={`leading-none font-black ${isAction(value) ? "text-[80px]" : "text-[100px]"}`}
          style={{
            color: p[4],
            filter: "drop-shadow(0 4px 3px rgba(0,0,0,0.25))",
          }}
        >
          {glyph(value)}
        </span>
      </div>

      <div className="z-10 flex justify-between text-[10px] font-bold text-white tracking-widest uppercase">
        <span>{COLOR_NAME[color]}</span>
        <span>{valueLabel(value)}</span>
      </div>
    </div>
  );
}

function PapercutWild({ value }: WildProps) {
  return (
    <div
      className={`${CARD_BASE} justify-between p-3.5 rounded-xl bg-[#2b2d42] font-sans shadow-[0_10px_25px_-8px_rgba(0,0,0,0.7)] group`}
    >
      <div
        className="absolute inset-0 opacity-70 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(#fff 0.8px, transparent 1px)",
          backgroundSize: "23px 19px",
        }}
      />
      <div className="absolute top-8 left-6 w-8 h-8 rounded-full bg-[#fef3c7] shadow-[0_0_20px_rgba(254,243,199,0.6)]" />
      <PaperLayer
        d="M0 70 L40 30 L70 55 L120 10 L160 50 L200 25 V160 H0Z"
        fill={PAPERCUT.blue[3]}
        height={210}
        shadow={0.35}
        className="transition-transform duration-500 group-hover:-translate-y-1"
      />
      <PaperLayer
        d="M0 50 L30 70 L80 25 L120 60 L170 30 L200 55 V160 H0Z"
        fill={PAPERCUT.green[3]}
        height={165}
        shadow={0.35}
        className="transition-transform duration-500 group-hover:-translate-y-2"
      />
      <PaperLayer
        d="M0 70 L50 30 L90 65 L140 35 L200 70 V160 H0Z"
        fill={PAPERCUT.yellow[3]}
        height={120}
        shadow={0.35}
        className="transition-transform duration-500 group-hover:-translate-y-3"
      />
      <PaperLayer
        d="M0 60 Q50 30 100 60 T200 55 V160 H0Z"
        fill={PAPERCUT.red[3]}
        height={76}
        shadow={0.4}
        className="transition-transform duration-500 group-hover:-translate-y-4"
      />

      <span className="z-10 self-end bg-white text-[10px] font-black tracking-widest text-[#2b2d42] px-2 py-0.5 rounded shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
        JOKER
      </span>

      <div className="z-10 text-center -mt-14">
        <span
          className={`font-black text-white ${value === "+4" ? "text-7xl" : "text-5xl"}`}
          style={{ filter: "drop-shadow(0 4px 4px rgba(0,0,0,0.4))" }}
        >
          {value === "+4" ? "+4" : "★"}
        </span>
        <div className="text-[10px] font-bold tracking-[0.3em] text-white/80 uppercase mt-1">
          Quatre saisons
        </div>
      </div>

      <div className="z-10 flex justify-center gap-1.5">
        {COLORS.map((c) => (
          <span
            key={c}
            className="w-3 h-3 rounded-sm shadow-[0_2px_3px_rgba(0,0,0,0.4)]"
            style={{ background: PAPERCUT[c][3] }}
          />
        ))}
      </div>
    </div>
  );
}

/* ================================================================== */
/* CATALOGUE DES STYLES RETENUS                                        */
/* ================================================================== */
type StyleKey =
  "gameboy" | "win95" | "ukiyoe" | "riso" | "deco" | "popart" | "papercut";
type StyleDef = {
  key: StyleKey;
  label: string;
  title: string;
  subtitle: string;
  accent: string;
  Card: React.FC<CardProps>;
  Wild: React.FC<WildProps>;
  hand: [UnoColor, CardValue][];
};

const STYLES: StyleDef[] = [
  {
    key: "gameboy",
    label: "Game Boy",
    title: "Game Boy (La coque est la couleur)",
    subtitle: "Coque colorée • Écran teinté • Sprites pixel",
    accent: "#9bbc0f",
    Card: GameBoyCard,
    Wild: GameBoyWild,
    hand: [
      ["red", "7"],
      ["yellow", "reverse"],
      ["green", "2"],
      ["blue", "skip"],
    ],
  },
  {
    key: "win95",
    label: "Win95 Vapor",
    title: "Win95 × Vaporwave (Fenêtre teintée)",
    subtitle: "Barre de titre + écran dans la couleur • Sol en grille",
    accent: "#01cdfe",
    Card: Win95Card,
    Wild: Win95Wild,
    hand: [
      ["red", "+2"],
      ["yellow", "1"],
      ["green", "skip"],
      ["blue", "5"],
    ],
  },
  {
    key: "ukiyoe",
    label: "Ukiyo-e",
    title: "Ukiyo-e (Vagues seigaiha teintées)",
    subtitle: "Fond plein dans la couleur • Lune de papier • Kanji de couleur",
    accent: "#e3705c",
    Card: UkiyoCard,
    Wild: UkiyoWild,
    hand: [
      ["red", "3"],
      ["yellow", "+2"],
      ["green", "8"],
      ["blue", "reverse"],
    ],
  },
  {
    key: "riso",
    label: "Risograph",
    title: "Risograph (Aplat d'encre pleine)",
    subtitle: "Une encre = une couleur • Marge papier • Trame dégradée",
    accent: "#f2464f",
    Card: RisoCard,
    Wild: RisoWild,
    hand: [
      ["red", "4"],
      ["yellow", "skip"],
      ["green", "0"],
      ["blue", "+2"],
    ],
  },
  {
    key: "deco",
    label: "Art Déco",
    title: "Art Déco (Laque précieuse)",
    subtitle: "Rubis • Topaze • Émeraude • Saphir",
    accent: "#e8c766",
    Card: DecoCard,
    Wild: DecoWild,
    hand: [
      ["red", "reverse"],
      ["yellow", "9"],
      ["green", "6"],
      ["blue", "skip"],
    ],
  },
  {
    key: "popart",
    label: "Pop Art",
    title: "Pop Art (Trame Ben-Day pleine)",
    subtitle: "Fond tramé dans la couleur • Onomatopées • Contours épais",
    accent: "#ffe14d",
    Card: PopCard,
    Wild: PopWild,
    hand: [
      ["red", "5"],
      ["yellow", "1"],
      ["green", "+2"],
      ["blue", "reverse"],
    ],
  },
  {
    key: "papercut",
    label: "Papier découpé",
    title: "Papier découpé (Paysage monochrome)",
    subtitle:
      "Toutes les strates dans la même teinte • Chiffre dans la teinte la plus sombre",
    accent: "#ffb627",
    Card: PapercutCard,
    Wild: PapercutWild,
    hand: [
      ["red", "skip"],
      ["yellow", "8"],
      ["green", "reverse"],
      ["blue", "6"],
    ],
  },
];

/* ================================================================== */
/* PAGE                                                                */
/* ================================================================== */
export function App() {
  const [activeTab, setActiveTab] = useState<StyleKey | "all">("all");
  const [fullDeck, setFullDeck] = useState(false);

  const visible = STYLES.filter(
    (s) => activeTab === "all" || activeTab === s.key,
  );

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white pb-20">
      {/* Topbar HUD */}
      <header className="border-b border-white/10 px-8 py-4 flex flex-wrap gap-3 items-center justify-between backdrop-blur-md bg-black/60 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-rose-500 rounded-full animate-ping" />
          <span className="text-white font-black text-xl tracking-tighter">
            UNO<span className="text-rose-500">//</span>ATELIER
          </span>
          <span className="hidden md:inline-block text-[10px] font-mono uppercase tracking-widest text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
            Sélection — 7 styles • couleur lisible d'un coup d'œil
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filtres de style */}
          <div className="flex flex-wrap justify-end items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10 text-xs font-mono">
            {([["all", "Toutes"]] as [StyleKey | "all", string][])
              .concat(STYLES.map((s) => [s.key, s.label]))
              .map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeTab === key
                      ? "bg-rose-600 text-white font-bold shadow-lg shadow-rose-900/40"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {label}
                </button>
              ))}
          </div>

          {/* Main d'exemple / jeu complet */}
          <button
            onClick={() => setFullDeck((v) => !v)}
            className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs font-mono text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            {fullDeck ? "◧ Main d'exemple" : "▦ Jeu complet (54 cartes)"}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full px-6 pt-10 flex flex-col gap-16">
        {visible.map((s, i) => (
          <section key={s.key} className="flex flex-col gap-6">
            <div
              className="border-b pb-3 flex flex-wrap gap-2 items-baseline justify-between"
              style={{ borderColor: s.accent + "33" }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ background: s.accent }}
                />
                <h2
                  className="text-lg font-black tracking-wider uppercase font-mono"
                  style={{ color: s.accent }}
                >
                  Style {i + 1} — {s.title}
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-500">
                {s.subtitle}
              </span>
            </div>

            {fullDeck ? (
              <div className="flex flex-col gap-8">
                {COLORS.map((c) => (
                  <div key={c} className="flex flex-col gap-3">
                    <span className="text-xs font-mono uppercase tracking-widest text-slate-400">
                      {COLOR_NAME[c]}
                    </span>
                    <div className="flex flex-wrap gap-6">
                      {VALUES.map((v) => (
                        <s.Card key={v} color={c} value={v} />
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex flex-col gap-3">
                  <span className="text-xs font-mono uppercase tracking-widest text-slate-400">
                    Jokers
                  </span>
                  <div className="flex flex-wrap gap-6">
                    <s.Wild value="wild" />
                    <s.Wild value="+4" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 justify-items-center">
                {s.hand.map(([c, v]) => (
                  <s.Card key={c + v} color={c} value={v} />
                ))}
                <s.Wild value="+4" />
              </div>
            )}
          </section>
        ))}
      </main>
    </div>
  );
}
