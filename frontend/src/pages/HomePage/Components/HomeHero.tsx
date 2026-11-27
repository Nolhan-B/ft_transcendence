import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import type { CardColor, CardValue } from "shared";
import { Card } from "../../../components/cards/Card";
import { CardFace } from "../../../components/game/CardFace";
import { StartPlayingButton } from "../Components/StartPlayingButton";
import { BrandLogo } from "../../../components/texts/BrandLogo";
import { WEBSITE_DESCRIPTION } from "../../../constants";
import { BrandName } from "../../../components/texts/BrandName";

interface FloatingCardItem {
  color: CardColor;
  value: CardValue;
  className: string;
  rotate: string;
  delay: string;
  duration: string;
}

// Decorative cards drifting behind the hero using the shared Card component.
// Hidden from assistive tech; motion is disabled by prefers-reduced-motion.
const FLOATING_CARDS: FloatingCardItem[] = [
  {
    color: "red",
    value: "7",
    className: "left-[5%] top-[16%]",
    rotate: "-12deg",
    delay: "0s",
    duration: "8s",
  },
  {
    color: "blue",
    value: "reverse",
    className: "left-[14%] bottom-[12%]",
    rotate: "8deg",
    delay: "1.2s",
    duration: "9s",
  },
  {
    color: "yellow",
    value: "draw2",
    className: "right-[6%] top-[12%]",
    rotate: "12deg",
    delay: "0.6s",
    duration: "7.5s",
  },
  {
    color: "green",
    value: "skip",
    className: "right-[15%] bottom-[14%]",
    rotate: "-8deg",
    delay: "1.8s",
    duration: "10s",
  },
  {
    color: "wild",
    value: "wild_draw4",
    className: "left-[26%] top-[5%] hidden xl:block",
    rotate: "4deg",
    delay: "2.4s",
    duration: "11s",
  },
];

export function HomeHero() {
  return (
    <section className="hero relative min-h-[calc(100vh-8rem)] overflow-hidden">
      {/* Spotlight behind the title */}
      <div
        aria-hidden="true"
        className="hero-glow pointer-events-none absolute top-1/4 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-accent/20 blur-3xl"
      />

      {/* Floating cards using the real Card & CardFace components */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 max-sm:hidden"
      >
        {FLOATING_CARDS.map((card) => (
          <div
            key={`${card.value}-${card.className}`}
            className={`hero-float absolute w-20 sm:w-28 ${card.className}`}
            style={
              {
                "--card-rotate": card.rotate,
                "--card-delay": card.delay,
                animationDuration: card.duration,
              } as CSSProperties
            }
          >
            <Card variant="game">
              <CardFace color={card.color} value={card.value} />
            </Card>
          </div>
        ))}
      </div>

      <div className="hero-content relative z-10 flex-col gap-8 px-4 py-14 text-center">
        <BrandLogo size="xl" className="animate-pop" />

        <div className="max-w-3xl">
          <p className="mb-4">
            <BrandName size="lg" />
          </p>
          <h1 className="text-display mb-5 text-5xl leading-tight sm:text-7xl">
            Play. <span className="text-accent">Bluff.</span>{" "}
            <span className="text-success">Win.</span>
          </h1>
          <p className="mx-auto max-w-xl text-base text-white/75 sm:text-lg">
            {WEBSITE_DESCRIPTION}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <StartPlayingButton>Play now</StartPlayingButton>
          <Link to="/rules" className="btn btn-lg">
            How to play
          </Link>
        </div>

        <ul className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm font-semibold">
          <li className="rounded-full border-2 bg-secondary px-4 py-1.5 text-secondary-content">
            Real-time multiplayer
          </li>
          <li className="rounded-full border-2 bg-accent px-4 py-1.5 text-accent-content">
            Ranked Elo
          </li>
          <li className="rounded-full border-2 bg-success px-4 py-1.5 text-success-content">
            Friends &amp; chat
          </li>
        </ul>
      </div>
    </section>
  );
}
