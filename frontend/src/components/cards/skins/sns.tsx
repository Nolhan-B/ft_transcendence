import type { ReactNode } from "react";
import { BrandLogo } from "../../texts/BrandLogo";
import {
  SKIN_ROOT,
  SUITS,
  glyph,
  type FaceProps,
  type Skin,
  type SuitColor,
  type SuitValue,
  type WildProps,
} from "./common";

// Default skin of the site: a colored card with a white edge, light diagonal
// stripes and the value in a white diamond

const BODY: Record<SuitColor, string> = {
  red: "var(--color-primary)",
  yellow: "var(--color-accent)",
  green: "var(--color-success)",
  blue: "var(--color-secondary)",
};

const STRIPES =
  "repeating-linear-gradient(135deg, rgb(255 255 255 / 0.08) 0 14px, transparent 14px 28px)";

function SkipIcon({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="3.2" />
      <path
        d="M6.5 17.5 17.5 6.5"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ReverseIcon({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M4 9h13l-4-4M20 15H7l4 4"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// The value: a number, "+2" or an icon
function Value({ value, big }: { value: SuitValue; big: boolean }) {
  if (value === "skip")
    return <SkipIcon className={big ? "size-20" : "size-8"} />;
  if (value === "reverse")
    return <ReverseIcon className={big ? "size-20" : "size-8"} />;
  const text = glyph(value);
  return (
    <span
      className={`leading-none font-black tracking-tight ${big ? (text.length > 1 ? "text-[64px]" : "text-[88px]") : "text-[30px]"}`}
    >
      {text}
    </span>
  );
}

function Frame({
  background,
  children,
}: {
  background: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`${SKIN_ROOT} rounded-[22px] border-[12px] border-white shadow-[0_6px_14px_rgb(0_0_0/0.35)]`}
      style={{ background, backgroundImage: STRIPES }}
    >
      {children}
    </div>
  );
}

function Corners({ children }: { children: ReactNode }) {
  return (
    <>
      <span className="absolute top-2.5 left-3 flex text-white drop-shadow-[0_2px_0_rgb(0_0_0/0.3)]">
        {children}
      </span>
      <span className="absolute right-3 bottom-2.5 flex rotate-180 text-white drop-shadow-[0_2px_0_rgb(0_0_0/0.3)]">
        {children}
      </span>
    </>
  );
}

function Face({ color, value }: FaceProps) {
  return (
    <Frame background={BODY[color]}>
      <Corners>
        <Value value={value} big={false} />
      </Corners>
      <div className="absolute inset-0 grid place-items-center">
        {/* The white diamond */}
        <div className="grid size-34 rotate-45 place-items-center rounded-[26px] bg-white shadow-[0_6px_0_rgb(0_0_0/0.18)]">
          <span className="flex -rotate-45" style={{ color: BODY[color] }}>
            <Value value={value} big />
          </span>
        </div>
      </div>
    </Frame>
  );
}

function Wild({ value }: WildProps) {
  return (
    <Frame background="#1b1b1b">
      <span className="absolute top-2.5 left-3 text-[30px] leading-none font-black text-white">
        {value === "wild_draw4" ? "+4" : "★"}
      </span>
      <span className="absolute right-3 bottom-2.5 rotate-180 text-[30px] leading-none font-black text-white">
        {value === "wild_draw4" ? "+4" : "★"}
      </span>
      <div className="absolute inset-0 grid place-items-center">
        {/* Diamond split in the four colors */}
        <div
          className="grid size-34 rotate-45 place-items-center overflow-hidden rounded-[26px] border-[6px] border-white"
          style={{
            background: `conic-gradient(${SUITS.map((c, i) => `${BODY[c]} ${i * 90}deg ${(i + 1) * 90}deg`).join(", ")})`,
          }}
        >
          <span className="-rotate-45 text-[60px] leading-none font-black text-white drop-shadow-[0_3px_0_rgb(0_0_0/0.45)]">
            {value === "wild_draw4" ? "+4" : "★"}
          </span>
        </div>
      </div>
    </Frame>
  );
}

function Back() {
  return (
    <div
      className={`${SKIN_ROOT} items-center justify-center rounded-[22px] border-[12px] border-white bg-[#1b1b1b] shadow-[0_6px_14px_rgb(0_0_0/0.35)]`}
      style={{
        backgroundImage:
          "repeating-linear-gradient(45deg, rgb(255 255 255 / 0.05) 0 10px, transparent 10px 20px), repeating-linear-gradient(-45deg, rgb(255 255 255 / 0.05) 0 10px, transparent 10px 20px)",
      }}
    >
      <div className="absolute inset-3 rounded-[12px] border-2 border-white/15" />
      <BrandLogo size="lg" />
    </div>
  );
}

export const SNS_SKIN: Skin = {
  id: "sns",
  label: "SNS",
  subtitle: "The house cards: white edge, value in a diamond",
  accent: "#fbc02d",
  Face,
  Wild,
  Back,
};
