import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import type { CardValue } from "shared";
import snsLogo from "../../../assets/images/sns-logo.svg";
import { Card } from "../../../components/cards/Card";
import type { CardColor } from "../../../components/cards/Card";
import { CardFace } from "../../../components/game/CardFace";
import { StartPlayingButton } from "../Components/StartPlayingButton";
import { WEBSITE_DESCRIPTION, WEBSITE_NAME } from "../../../constants";

interface FloatingCardItem {
  color: CardColor;
  value: CardValue;
  className: string;
  rotate: string;
  delay: string;
  duration: string;
}

// Decorative neon cards drifting behind the hero using the shared Card component.
// Hidden from assistive tech; motion is disabled by prefers-reduced-motion.
const FLOATING_CARDS: FloatingCardItem[] = [
  {
    color: "primary",
    value: "7",
    className: "left-[5%] top-[16%]",
    rotate: "-12deg",
    delay: "0s",
    duration: "8s",
  },
  {
    color: "secondary",
    value: "reverse",
    className: "left-[13%] bottom-[14%]",
    rotate: "8deg",
    delay: "1.2s",
    duration: "9s",
  },
  {
    color: "accent",
    value: "draw2",
    className: "right-[6%] top-[14%]",
    rotate: "12deg",
    delay: "0.6s",
    duration: "7.5s",
  },
  {
    color: "success",
    value: "skip",
    className: "right-[14%] bottom-[16%]",
    rotate: "-8deg",
    delay: "1.8s",
    duration: "10s",
  },
  {
    color: "primary",
    value: "wild_draw4",
    className: "left-[44%] top-[3%] hidden lg:block",
    rotate: "4deg",
    delay: "2.4s",
    duration: "11s",
  },
];

// Crisp vector sliced sunset SVG (modern Miami Vice aesthetic, no pixel art)
function MiamiSunset() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 400"
      className="pointer-events-none absolute left-1/2 top-[44%] h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 opacity-80 sm:h-[460px] sm:w-[460px]"
    >
      <defs>
        <linearGradient id="miami-sun-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffd23f" />
          <stop offset="48%" stopColor="#ff6b4a" />
          <stop offset="100%" stopColor="#ff2a85" />
        </linearGradient>
        <mask id="miami-sun-slices">
          <rect width="400" height="400" fill="white" />
          {/* Progressive horizontal slices near the lower half of the sun */}
          <rect x="0" y="218" width="400" height="6" fill="black" />
          <rect x="0" y="242" width="400" height="9" fill="black" />
          <rect x="0" y="268" width="400" height="12" fill="black" />
          <rect x="0" y="298" width="400" height="16" fill="black" />
          <rect x="0" y="332" width="400" height="22" fill="black" />
        </mask>
      </defs>
      <circle
        cx="200"
        cy="200"
        r="175"
        fill="url(#miami-sun-grad)"
        mask="url(#miami-sun-slices)"
      />
    </svg>
  );
}

export function HomeHero() {
  return (
    <section className="hero relative min-h-[calc(100vh-8rem)] overflow-hidden rounded-box border-2 border-primary/35 bg-gradient-to-b from-[#090414] via-[#1a0b2e] to-[#280d3d] shadow-[0_0_40px_rgba(255,42,133,0.12)]">
      {/* Nocturnal purple & magenta atmospheric glows */}
      <div
        aria-hidden="true"
        className="hero-glow pointer-events-none absolute left-1/2 top-[42%] size-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="hero-glow pointer-events-none absolute -left-24 top-1/4 size-96 rounded-full bg-secondary/14 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="hero-glow pointer-events-none absolute -right-24 bottom-1/4 size-96 rounded-full bg-tertiary/20 blur-3xl [animation-delay:2s]"
      />

      {/* Sliced vector sunset behind the focal stack */}
      <MiamiSunset />

      {/* Neon horizon line + crisp perspective floor */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[34%] overflow-hidden"
      >
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-secondary to-transparent shadow-[0_0_18px_var(--color-secondary)]" />
        <div className="miami-floor h-[220%] w-full" />
      </div>

      {/* Floating neon cards */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {FLOATING_CARDS.map((card) => (
          <div
            key={`${card.value}-${card.className}`}
            className={`hero-float absolute w-20 opacity-85 sm:w-24 ${card.className}`}
            style={
              {
                "--card-rotate": card.rotate,
                "--card-delay": card.delay,
                animationDuration: card.duration,
              } as CSSProperties
            }
          >
            <Card color={card.color} variant="neon">
              <CardFace value={card.value} />
            </Card>
          </div>
        ))}
      </div>

      <div className="hero-content relative z-10 flex-col gap-5 px-4 py-14 text-center">
        <img
          src={snsLogo}
          alt="SNS"
          className="h-40 w-auto drop-shadow-[0_0_18px_rgba(0,240,255,0.4)] sm:h-52"
        />

        <div className="max-w-3xl">
          {/* Miami Vice neon script signature */}
          <p className="font-miami mb-2 -rotate-2 text-4xl tracking-wide text-secondary drop-shadow-[0_0_12px_rgba(0,240,255,0.7)] sm:text-5xl">
            {WEBSITE_NAME}
          </p>

          {/* Hotline Miami slanted high-impact headline */}
          <h1 className="font-hotline mb-5 bg-gradient-to-r from-accent via-sunset to-primary bg-clip-text text-5xl font-bold italic uppercase tracking-tight leading-none text-transparent drop-shadow-[4px_4px_0px_rgba(11,6,23,0.9)] sm:text-7xl">
            Play. Bluff. Win.
          </h1>

          <p className="mx-auto max-w-xl rounded-full border border-primary/25 bg-base-300/65 px-5 py-2 text-sm text-base-content/85 backdrop-blur-sm sm:text-base">
            {WEBSITE_DESCRIPTION}
          </p>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
          <StartPlayingButton>Play now</StartPlayingButton>
          <Link
            to="/rules"
            className="btn btn-lg font-hotline border-2 border-secondary bg-base-300/70 text-lg font-bold italic uppercase tracking-wider text-secondary shadow-[4px_4px_0px_var(--color-primary)] backdrop-blur-sm transition-transform duration-150 hover:-translate-y-0.5 hover:border-secondary hover:bg-secondary hover:text-base-300"
          >
            How to play
          </Link>
        </div>

        <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-semibold text-base-content/80">
          <li className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-secondary shadow-[0_0_10px_var(--color-secondary)]" />
            Real-time multiplayer
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent)]" />
            Ranked Elo
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-primary shadow-[0_0_10px_var(--color-primary)]" />
            Friends &amp; chat
          </li>
        </ul>
      </div>
    </section>
  );
}
