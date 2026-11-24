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

// Paper cut: a landscape of paper layers, all in shades of the color

// [sky, sun, back hill, middle hill, front hill]
const PAPERCUT: Record<SuitColor, [string, string, string, string, string]> = {
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
      className={`pointer-events-none absolute bottom-0 left-0 w-full ${className}`}
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

const CARD = `${SKIN_ROOT} justify-between rounded-xl p-3.5 font-sans`;

function Face({ color, value }: FaceProps) {
  const p = PAPERCUT[color];
  return (
    <div
      className={`${CARD} group shadow-[0_10px_25px_-8px_rgba(0,0,0,0.5)]`}
      style={{ background: p[0] }}
    >
      <div
        className="absolute top-12 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full transition-transform duration-700 group-hover:translate-y-3"
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
        className="z-10 self-start rounded bg-white px-2 py-0.5 text-[10px] font-black tracking-widest uppercase shadow-[0_2px_4px_rgba(0,0,0,0.2)]"
        style={{ color: p[4] }}
      >
        {COLOR_NAME[color]}
      </span>

      <div className="z-10 -mt-16 text-center">
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

      <div className="z-10 flex justify-between text-[10px] font-bold tracking-widest text-white uppercase">
        <span>{COLOR_NAME[color]}</span>
        <span>{valueLabel(value)}</span>
      </div>
    </div>
  );
}

// The night sky with mountains, shared by the wild cards and the back
function Night({ lift = true }: { lift?: boolean }) {
  // Full class names so that Tailwind finds them
  const LIFT = [
    "",
    "group-hover:-translate-y-1",
    "group-hover:-translate-y-2",
    "group-hover:-translate-y-3",
    "group-hover:-translate-y-4",
  ];
  const move = (n: number) =>
    lift ? `transition-transform duration-500 ${LIFT[n]}` : "";
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage: "radial-gradient(#fff 0.8px, transparent 1px)",
          backgroundSize: "23px 19px",
        }}
      />
      <div className="absolute top-8 left-6 h-8 w-8 rounded-full bg-[#fef3c7] shadow-[0_0_20px_rgba(254,243,199,0.6)]" />
      <PaperLayer
        d="M0 70 L40 30 L70 55 L120 10 L160 50 L200 25 V160 H0Z"
        fill={PAPERCUT.blue[3]}
        height={210}
        shadow={0.35}
        className={move(1)}
      />
      <PaperLayer
        d="M0 50 L30 70 L80 25 L120 60 L170 30 L200 55 V160 H0Z"
        fill={PAPERCUT.green[3]}
        height={165}
        shadow={0.35}
        className={move(2)}
      />
      <PaperLayer
        d="M0 70 L50 30 L90 65 L140 35 L200 70 V160 H0Z"
        fill={PAPERCUT.yellow[3]}
        height={120}
        shadow={0.35}
        className={move(3)}
      />
      <PaperLayer
        d="M0 60 Q50 30 100 60 T200 55 V160 H0Z"
        fill={PAPERCUT.red[3]}
        height={76}
        shadow={0.4}
        className={move(4)}
      />
    </>
  );
}

function Wild({ value }: WildProps) {
  return (
    <div
      className={`${CARD} group bg-[#2b2d42] shadow-[0_10px_25px_-8px_rgba(0,0,0,0.7)]`}
    >
      <Night />
      <span className="z-10 self-end rounded bg-white px-2 py-0.5 text-[10px] font-black tracking-widest text-[#2b2d42] shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
        WILD
      </span>

      <div className="z-10 -mt-14 text-center">
        <span
          className={`font-black text-white ${value === "wild_draw4" ? "text-7xl" : "text-5xl"}`}
          style={{ filter: "drop-shadow(0 4px 4px rgba(0,0,0,0.4))" }}
        >
          {value === "wild_draw4" ? "+4" : "★"}
        </span>
        <div className="mt-1 text-[10px] font-bold tracking-[0.3em] text-white/80 uppercase">
          Four seasons
        </div>
      </div>

      <div className="z-10 flex justify-center gap-1.5">
        {SUITS.map((c) => (
          <span
            key={c}
            className="h-3 w-3 rounded-sm shadow-[0_2px_3px_rgba(0,0,0,0.4)]"
            style={{ background: PAPERCUT[c][3] }}
          />
        ))}
      </div>
    </div>
  );
}

function Back() {
  return (
    <div
      className={`${CARD} items-center bg-[#2b2d42] shadow-[0_10px_25px_-8px_rgba(0,0,0,0.7)]`}
    >
      <Night lift={false} />
      <span className="z-10 mt-16 text-4xl font-black tracking-widest text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.4)]">
        SNS
      </span>
    </div>
  );
}

export const PAPERCUT_SKIN: Skin = {
  id: "papercut",
  label: "Paper cut",
  subtitle: "Monochrome paper landscape, value in the darkest shade",
  accent: "#ffb627",
  Face,
  Wild,
  Back,
};
