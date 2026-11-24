import {
  ACTION_NAME,
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

// Win95 x Vaporwave: a window with a tinted title bar and a synthwave screen

const BEVEL_OUT =
  "border-t-white border-l-white border-r-[#404040] border-b-[#404040]";
const BEVEL_IN =
  "border-t-[#404040] border-l-[#404040] border-r-white border-b-white";

const W95: Record<
  SuitColor,
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

const SLUG: Record<string, string> = { draw2: "plus2" };

function TitleBar({
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
      className="flex items-center justify-between px-1.5 py-0.5 text-[11px] font-bold text-white"
      style={{ background }}
    >
      <span className="flex items-center gap-1 truncate">
        {swatch && (
          <span
            className="h-3 w-3 shrink-0 border border-black"
            style={{ background: swatch }}
          />
        )}
        {title}
      </span>
      <div className="flex shrink-0 gap-0.5">
        {["_", "□", "×"].map((b) => (
          <span
            key={b}
            className={`flex h-3.5 w-4 items-center justify-center border bg-[#c0c0c0] text-[9px] leading-none text-black ${BEVEL_OUT}`}
          >
            {b}
          </span>
        ))}
      </div>
    </div>
  );
}

const WINDOW = `${SKIN_ROOT} border-2 bg-[#c0c0c0] p-1 font-sans ${BEVEL_OUT}`;

function Face({ color, value }: FaceProps) {
  const p = W95[color];
  return (
    <div className={WINDOW} style={{ boxShadow: `8px 8px 0 ${p.title[1]}` }}>
      <TitleBar
        background={`linear-gradient(90deg, ${p.title[0]}, ${p.title[1]})`}
        title={`${COLOR_NAME[color].toLowerCase()}_${SLUG[value] ?? value}.exe`}
        swatch={p.sky[1]}
      />
      <div className="flex gap-2 px-1 py-0.5 text-[10px] text-black">
        <span>
          <u>F</u>ile
        </span>
        <span>
          <u>E</u>dit
        </span>
        <span>
          <u>?</u>
        </span>
      </div>

      <div
        className={`relative m-1 flex-1 overflow-hidden border-2 ${BEVEL_IN}`}
        style={{ background: `linear-gradient(${p.sky[0]}, ${p.sky[1]})` }}
      >
        <div
          className="absolute bottom-14 left-1/2 h-28 w-28 -translate-x-1/2 rounded-full"
          style={{
            background:
              "repeating-linear-gradient(to bottom, rgba(255,255,255,0.85) 0 9px, transparent 9px 13px)",
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-20"
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
            className={`absolute top-1 left-1 z-10 border bg-[#c0c0c0] px-1 text-[9px] font-bold text-black ${BEVEL_OUT}`}
          >
            {ACTION_NAME[value]}
          </span>
        )}
        <div
          className={`absolute inset-0 flex items-center justify-center font-black text-white italic ${isAction(value) ? "text-7xl" : "text-8xl"}`}
          style={{ textShadow: `3px 3px 0 ${p.deep}, 6px 6px 0 #000` }}
        >
          {glyph(value)}
        </div>
      </div>

      <div className="flex gap-1 text-[9px] text-black">
        <span
          className={`flex flex-1 items-center gap-1 border px-1 font-bold uppercase ${BEVEL_IN}`}
        >
          <span
            className="h-2 w-2 border border-black"
            style={{ background: p.sky[1] }}
          />
          {COLOR_NAME[color]}
        </span>
        <span className={`border px-1 ${BEVEL_IN}`}>{valueLabel(value)}</span>
      </div>
    </div>
  );
}

function Wild({ value }: WildProps) {
  return (
    <div className={`${WINDOW} shadow-[8px_8px_0_#111]`}>
      <TitleBar
        background="linear-gradient(90deg, #e2364a, #e0aa00, #1fae5a, #1f6fe0)"
        title={`wild_${value === "wild_draw4" ? "plus4" : "card"}.exe`}
      />
      <div className="flex gap-2 px-1 py-0.5 text-[10px] text-black">
        <span>
          <u>F</u>ile
        </span>
        <span>
          <u>C</u>olor
        </span>
      </div>

      <div
        className={`relative m-1 flex flex-1 flex-col items-center justify-center gap-3 overflow-hidden border-2 bg-[#14101f] ${BEVEL_IN}`}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage: "radial-gradient(#fff 0.6px, transparent 0.8px)",
            backgroundSize: "18px 22px",
          }}
        />
        <div className="z-10 grid -skew-y-6 grid-cols-2 gap-1">
          <span className="h-9 w-9 bg-[#e2364a]" />
          <span className="h-9 w-9 bg-[#1fae5a]" />
          <span className="h-9 w-9 bg-[#1f6fe0]" />
          <span className="h-9 w-9 bg-[#f5c400]" />
        </div>
        <span
          className={`z-10 font-black text-white italic ${value === "wild_draw4" ? "text-6xl" : "text-3xl"}`}
          style={{ textShadow: "3px 3px 0 #000" }}
        >
          {value === "wild_draw4" ? "+4" : "WILD"}
        </span>
      </div>

      <div className="px-1 pb-1">
        <p className="mb-0.5 text-[9px] text-black">Choose a color...</p>
        <div
          className={`flex h-4 gap-[2px] border-2 bg-white p-[2px] ${BEVEL_IN}`}
        >
          <span className="flex-1 bg-[#e2364a]" />
          <span className="flex-1 bg-[#f5c400]" />
          <span className="flex-1 bg-[#1fae5a]" />
          <span className="flex-1 bg-[#1f6fe0]" />
        </div>
      </div>
    </div>
  );
}

function Back() {
  return (
    <div className={`${WINDOW} shadow-[8px_8px_0_#111]`}>
      <TitleBar
        background="linear-gradient(90deg, #000080, #1084d0)"
        title="sns.exe"
      />
      <div
        className={`relative m-1 flex flex-1 flex-col items-center justify-center gap-3 border-2 bg-[#008080] ${BEVEL_IN}`}
      >
        <div className="grid grid-cols-2 gap-1 -skew-y-6">
          <span className="h-10 w-10 bg-[#e2364a]" />
          <span className="h-10 w-10 bg-[#1fae5a]" />
          <span className="h-10 w-10 bg-[#1f6fe0]" />
          <span className="h-10 w-10 bg-[#f5c400]" />
        </div>
        <span className="text-4xl font-black text-white italic [text-shadow:3px_3px_0_#000]">
          SNS
        </span>
      </div>
      <div className="flex gap-1 px-1 pb-1 text-[9px] text-black">
        <span className={`border px-1 font-bold ${BEVEL_OUT}`}>Start</span>
        <span className={`flex-1 border px-1 text-right ${BEVEL_IN}`}>
          12:00
        </span>
      </div>
    </div>
  );
}

export const WIN95_SKIN: Skin = {
  id: "win95",
  label: "Win95 Vapor",
  subtitle: "Tinted title bar and screen, grid floor",
  accent: "#01cdfe",
  Face,
  Wild,
  Back,
};
