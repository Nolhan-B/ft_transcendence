import {
  ACTION_NAME,
  COLOR_NAME,
  SKIN_ROOT,
  isAction,
  type FaceProps,
  type Skin,
  type SuitColor,
  type SuitValue,
  type WildProps,
} from "./common";

// Game Boy: the shell is the color, a tinted screen shows a pixel sprite

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
// "SNS" in pixels, for the back: the letters side by side, one blank column
// between them
const PX_S = ["01111", "10000", "10000", "01110", "00001", "00001", "11110"];
const PX_N = ["10001", "11001", "10101", "10101", "10011", "10001", "10001"];
const PX_SNS = PX_S.map((row, i) => `${row}0${PX_N[i]}0${row}`);
const PX_WILD_PALETTE = {
  r: "#e8323c",
  y: "#f2b705",
  g: "#2fa84f",
  b: "#2f6fdb",
};

function gbSprite(value: SuitValue): { rows: string[]; size: number } {
  if (value === "skip") return { rows: PX_SKIP, size: 8 };
  if (value === "reverse") return { rows: PX_REV, size: 6 };
  if (value === "draw2")
    return {
      rows: PX_PLUS.map((r, i) => r + "0" + PX_DIGITS["2"][i]),
      size: 6,
    };
  return { rows: PX_DIGITS[value], size: 9 };
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
  SuitColor,
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
    <div className="z-10 mt-auto flex items-center justify-between px-1 pb-2">
      <div className="relative h-12 w-12">
        <div className="absolute top-1/2 h-4 w-12 -translate-y-1/2 rounded-sm bg-[#1c1c1c]" />
        <div className="absolute left-1/2 h-12 w-4 -translate-x-1/2 rounded-sm bg-[#1c1c1c]" />
      </div>
      <div className="flex -rotate-[25deg] items-end gap-2">
        {["B", "A"].map((l, i) => (
          <span
            key={l}
            className={`flex h-7 w-7 items-center justify-center rounded-full bg-[#1c1c1c] text-[9px] font-black text-white/80 shadow-[inset_-2px_-2px_0_rgba(255,255,255,0.15)] ${i === 1 ? "mb-3" : ""}`}
          >
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

const SHELL = `${SKIN_ROOT} gap-2 rounded-lg rounded-br-[44px] border-2 p-3 font-mono`;

function Face({ color, value }: FaceProps) {
  const p = GB[color];
  const { rows, size } = gbSprite(value);
  return (
    <div
      className={SHELL}
      style={{
        background: p.shell,
        borderColor: p.dark,
        boxShadow: `inset -4px -4px 0 ${p.dark}, 6px 6px 0 #0d0d10`,
      }}
    >
      <div className="flex flex-col gap-1.5 rounded-md rounded-br-[22px] bg-[#34343f] p-2.5 pb-3">
        <div className="flex items-center justify-between text-[7px] tracking-widest text-[#c4c3bc]">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_4px_#ef4444]" />
            BATTERY
          </span>
          <span>DOT MATRIX</span>
        </div>
        <div
          className="flex h-36 flex-col justify-between p-2"
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
            className="text-center text-[8px] font-black opacity-70"
            style={{ color: p.ink }}
          >
            ▶ PRESS A
          </div>
        </div>
      </div>

      <div
        className="flex items-baseline justify-between px-1"
        style={{ color: p.text }}
      >
        <span className="text-[13px] font-black tracking-tight italic">
          GAME SNS
        </span>
        <span className="text-[9px] font-black tracking-widest uppercase">
          {COLOR_NAME[color]}
        </span>
      </div>

      <GbControls />
    </div>
  );
}

function Wild({ value }: WildProps) {
  return (
    <div
      className={`${SHELL} border-[#0d0d10] bg-[#26262e] shadow-[inset_-4px_-4px_0_#15151a,6px_6px_0_#0d0d10]`}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(115deg, transparent 0 58%, #e8323c 58% 63%, #f2b705 63% 68%, #2fa84f 68% 73%, #2f6fdb 73% 78%, transparent 78%)",
        }}
      />
      <div className="z-10 flex flex-col gap-1.5 rounded-md rounded-br-[22px] bg-[#111116] p-2.5 pb-3">
        <div className="flex items-center justify-between text-[7px] tracking-widest text-[#c4c3bc]">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_#34d399]" />
            POWER
          </span>
          <span>COLOR</span>
        </div>
        <div className="flex h-36 flex-col justify-between bg-[#f4f4ee] p-2">
          <div className="flex justify-between text-[8px] font-black text-[#26262e]">
            <span>WILD</span>
            <span>{value === "wild_draw4" ? "BOSS +4" : "ANY COLOR"}</span>
          </div>
          <div className="mx-auto">
            <PixelSprite
              rows={value === "wild_draw4" ? PX_PLUS4 : PX_DIAMOND}
              palette={PX_WILD_PALETTE}
              size={7}
            />
          </div>
          <div className="flex justify-center gap-1">
            {Object.values(PX_WILD_PALETTE).map((c) => (
              <span key={c} className="h-3 w-3" style={{ background: c }} />
            ))}
          </div>
        </div>
      </div>

      <div className="z-10 px-1 text-[13px] font-black tracking-tight text-white italic">
        GAME SNS <span className="text-[#e8323c]">C</span>
        <span className="text-[#f2b705]">O</span>
        <span className="text-[#2fa84f]">L</span>
        <span className="text-[#5b93ef]">O</span>
        <span className="text-[#e8323c]">R</span>
      </div>

      <GbControls />
    </div>
  );
}

function Back() {
  return (
    <div
      className={`${SHELL} border-[#0d0d10] bg-[#8b8b96] shadow-[inset_-4px_-4px_0_#5e5e68,6px_6px_0_#0d0d10]`}
    >
      <div className="flex flex-col gap-1.5 rounded-md rounded-br-[22px] bg-[#34343f] p-2.5 pb-3">
        <div className="flex items-center justify-between text-[7px] tracking-widest text-[#c4c3bc]">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_4px_#ef4444]" />
            BATTERY
          </span>
          <span>DOT MATRIX</span>
        </div>
        <div className="flex h-36 flex-col items-center justify-center gap-3 bg-[#9bbc0f] p-2">
          <PixelSprite rows={PX_SNS} palette={{ "1": "#0f380f" }} size={6} />
          <span className="text-[8px] font-black text-[#0f380f]">
            LOADING...
          </span>
        </div>
      </div>
      <div className="px-1 text-[13px] font-black tracking-tight text-[#26262e] italic">
        GAME SNS
      </div>
      <GbControls />
    </div>
  );
}

export const GAMEBOY_SKIN: Skin = {
  id: "gameboy",
  label: "Game Boy",
  subtitle: "Colored shell, tinted screen, pixel sprites",
  accent: "#9bbc0f",
  Face,
  Wild,
  Back,
};
