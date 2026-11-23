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
    className: "left-[14%] bottom-[12%]",
    rotate: "8deg",
    delay: "1.2s",
    duration: "9s",
  },
  {
    color: "accent",
    value: "draw2",
    className: "right-[6%] top-[12%]",
    rotate: "12deg",
    delay: "0.6s",
    duration: "7.5s",
  },
  {
    color: "success",
    value: "skip",
    className: "right-[15%] bottom-[14%]",
    rotate: "-8deg",
    delay: "1.8s",
    duration: "10s",
  },
  {
    color: "primary",
    value: "wild_draw4",
    className: "left-[44%] top-[4%] hidden lg:block",
    rotate: "4deg",
    delay: "2.4s",
    duration: "11s",
  },
];

export function HomeHero() {
  return (
    <section className="hero relative min-h-[calc(100vh-8rem)] overflow-hidden rounded-box border-3 border-base-300 bg-base-300">
      {/* Subtle cyber grid faded out toward the edges, matching AuthPage */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, color-mix(in oklab, var(--color-secondary) 6%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--color-secondary) 6%, transparent) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse 85% 80% at 50% 50%, #000 35%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 85% 80% at 50% 50%, #000 35%, transparent 100%)",
        }}
      />

      {/* Ambient neon glows matching the SNS logo palette */}
      <div
        aria-hidden="true"
        className="hero-glow pointer-events-none absolute -left-24 top-1/4 size-96 rounded-full bg-secondary/12 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="hero-glow pointer-events-none absolute -right-24 bottom-1/4 size-96 rounded-full bg-primary/14 blur-3xl [animation-delay:2s]"
      />
      <div
        aria-hidden="true"
        className="hero-glow pointer-events-none absolute left-1/2 top-0 size-72 -translate-x-1/2 rounded-full bg-tertiary/14 blur-3xl [animation-delay:4s]"
      />

      {/* Floating cards using the real neon Card & CardFace components */}
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

      <div className="hero-content relative z-10 flex-col gap-6 px-4 py-14 text-center">
        <img
          src={snsLogo}
          alt="SNS"
          className="h-44 w-auto drop-shadow-[0_0_14px_color-mix(in_oklab,var(--color-secondary)_28%,transparent)] sm:h-56"
        />

        <div className="max-w-3xl">
          <p className="font-cyber mb-4 text-lg font-extrabold uppercase tracking-[0.28em] text-secondary drop-shadow-[0_0_8px_color-mix(in_oklab,var(--color-secondary)_45%,transparent)] sm:text-xl">
            {WEBSITE_NAME}
          </p>
          <h1 className="font-cyber mb-5 bg-gradient-to-r from-secondary via-tertiary to-primary bg-clip-text text-4xl font-black uppercase tracking-tight leading-tight text-transparent drop-shadow-[0_0_12px_color-mix(in_oklab,var(--color-tertiary)_30%,transparent)] sm:text-6xl">
            Play. Bluff. Win.
          </h1>
          <p className="mx-auto max-w-xl text-base text-base-content/70 sm:text-lg">
            {WEBSITE_DESCRIPTION}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <StartPlayingButton>Play now</StartPlayingButton>
          <Link
            to="/rules"
            className="btn btn-outline btn-lg font-cyber uppercase tracking-wider"
          >
            How to play
          </Link>
        </div>

        <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-base-content/60">
          <li className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-secondary" />
            Real-time multiplayer
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-tertiary" />
            Ranked Elo
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary" />
            Friends &amp; chat
          </li>
        </ul>
      </div>
    </section>
  );
}
