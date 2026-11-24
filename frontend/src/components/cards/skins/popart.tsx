import type { CSSProperties } from "react";
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

// Pop art: Ben-Day dots in the color, comic bursts, thick outlines

const POP: Record<SuitColor, { bg: string; dot: string }> = {
  red: { bg: "#ff4d5e", dot: "#c4001f" },
  yellow: { bg: "#ffe14d", dot: "#f0b400" },
  green: { bg: "#36c96a", dot: "#08933a" },
  blue: { bg: "#3d8bff", dot: "#0b4fc2" },
};
const BURST =
  "polygon(50% 0%, 61% 18%, 79% 9%, 76% 30%, 98% 32%, 82% 47%, 98% 65%, 76% 68%, 80% 91%, 61% 80%, 50% 100%, 39% 80%, 20% 91%, 24% 68%, 2% 65%, 18% 47%, 2% 32%, 24% 30%, 21% 9%, 39% 18%)";
const NUM_WORDS = ["POW!", "WHAM!", "BAM!", "ZAP!"];
const ACTION_WORDS: Record<ActionValue, string> = {
  skip: "STOP!",
  reverse: "ZWOOSH!",
  draw2: "GULP!",
};
const CAPTION: Record<ActionValue, string> = {
  skip: "Halt!",
  reverse: "U-turn!",
  draw2: "Bad luck...",
};
const COMIC_STROKE: CSSProperties = {
  WebkitTextStroke: "4px #000",
  paintOrder: "stroke fill",
  textShadow: "6px 6px 0 #000",
};

const dots = (
  p: { bg: string; dot: string },
  size = "9px 9px",
): CSSProperties => ({
  backgroundColor: p.bg,
  backgroundImage: `radial-gradient(${p.dot} 2px, transparent 2.2px)`,
  backgroundSize: size,
});

function Face({ color, value }: FaceProps) {
  const p = POP[color];
  const word = isAction(value)
    ? ACTION_WORDS[value]
    : NUM_WORDS[Number(value) % 4];
  return (
    <div
      className={`${SKIN_ROOT} justify-between border-4 border-black p-3 font-sans shadow-[8px_8px_0_#000]`}
      style={dots(p)}
    >
      <div
        className="absolute -top-1 -right-4 z-10 h-28 w-32 rotate-12 bg-black"
        style={{ clipPath: BURST }}
      >
        <div
          className="absolute inset-[6px] flex items-center justify-center bg-white"
          style={{ clipPath: BURST }}
        >
          <span className="-rotate-6 text-base font-black text-black italic">
            {word}
          </span>
        </div>
      </div>

      <span className="z-20 self-start border-2 border-black bg-[#fffbe0] px-1.5 py-0.5 text-[10px] font-black uppercase">
        {isAction(value) ? CAPTION[value] : "Suddenly..."}
      </span>

      <div className="z-10 my-auto text-center">
        <span
          className={`leading-none font-black text-white italic ${isAction(value) ? "text-[96px]" : "text-[130px]"}`}
          style={COMIC_STROKE}
        >
          {glyph(value)}
        </span>
      </div>

      <div className="z-10 flex items-center justify-between border-2 border-black bg-white px-2 py-1 text-[10px] font-black uppercase">
        <span className="flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-full border-2 border-black"
            style={{ background: p.bg }}
          />
          {COLOR_NAME[color]}
        </span>
        <span>{valueLabel(value)}</span>
      </div>
    </div>
  );
}

function Burst({ top, word }: { top: string; word: string }) {
  return (
    <div
      className="absolute inset-0 z-10 m-auto h-48 w-48 bg-black transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12"
      style={{ clipPath: BURST }}
    >
      <div
        className="absolute inset-[8px] flex flex-col items-center justify-center bg-white"
        style={{ clipPath: BURST }}
      >
        <span className="text-xs font-black text-black italic">{top}</span>
        <span
          className={`font-black text-white italic ${word.length < 4 ? "text-5xl" : "text-3xl"}`}
          style={{
            ...COMIC_STROKE,
            WebkitTextStroke: "3px #000",
            textShadow: "3px 3px 0 #000",
          }}
        >
          {word}
        </span>
      </div>
    </div>
  );
}

function Wild({ value }: WildProps) {
  return (
    <div
      className={`${SKIN_ROOT} group border-4 border-black bg-black font-sans shadow-[8px_8px_0_#000]`}
    >
      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-1">
        {SUITS.map((c) => (
          <div key={c} style={dots(POP[c], "8px 8px")} />
        ))}
      </div>
      <span className="absolute top-2 left-2 z-20 border-2 border-black bg-[#fffbe0] px-1.5 py-0.5 text-[10px] font-black uppercase">
        Wild!
      </span>
      <Burst top="KA-BOOM!" word={value === "wild_draw4" ? "+4" : "WILD"} />
      <div className="absolute inset-x-2 bottom-2 z-20 border-2 border-black bg-white px-2 py-1 text-center text-[10px] font-black uppercase">
        Pick your color
      </div>
    </div>
  );
}

function Back() {
  return (
    <div
      className={`${SKIN_ROOT} group border-4 border-black font-sans shadow-[8px_8px_0_#000]`}
      style={dots({ bg: "#fffbe0", dot: "#ff4d5e" }, "10px 10px")}
    >
      <Burst top="TO BE CONTINUED" word="SNS" />
    </div>
  );
}

export const POPART_SKIN: Skin = {
  id: "popart",
  label: "Pop Art",
  subtitle: "Ben-Day dots, comic bursts, thick outlines",
  accent: "#ffe14d",
  Face,
  Wild,
  Back,
};
