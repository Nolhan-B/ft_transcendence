import { Link } from "react-router-dom";
import unoLogo from "../../../assets/images/uno-logo.svg";
import { StartPlayingButton } from "../Components/StartPlayingButton";
import { WEBSITE_DESCRIPTION, WEBSITE_NAME } from "../../../constants";

// Decorative cards drifting behind the hero. Purely visual: hidden from
// assistive tech, and their motion is disabled by prefers-reduced-motion.
const FLOATING_CARDS = [
  {
    color: "bg-primary",
    label: "7",
    className: "left-[6%] top-[18%] -rotate-12",
    delay: "0s",
    duration: "8s",
  },
  {
    color: "bg-secondary",
    label: "3",
    className: "left-[16%] bottom-[16%] rotate-6",
    delay: "1.2s",
    duration: "9s",
  },
  {
    color: "bg-accent",
    label: "0",
    className: "right-[8%] top-[14%] rotate-12",
    delay: "0.6s",
    duration: "7.5s",
  },
  {
    color: "bg-success",
    label: "9",
    className: "right-[18%] bottom-[20%] -rotate-6",
    delay: "1.8s",
    duration: "10s",
  },
  {
    color: "bg-primary",
    label: "+4",
    className: "left-[42%] top-[8%] rotate-3",
    delay: "2.4s",
    duration: "11s",
  },
];

export function HomeHero() {
  return (
    <section className="hero relative min-h-[calc(100vh-8rem)] overflow-hidden rounded-box border-3 border-base-300 bg-base-200 bg-rays">
      {/* Colored glows */}
      <div
        aria-hidden="true"
        className="hero-glow pointer-events-none absolute -left-24 top-1/4 size-96 rounded-full bg-primary/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="hero-glow pointer-events-none absolute -right-24 bottom-1/4 size-96 rounded-full bg-secondary/25 blur-3xl [animation-delay:2s]"
      />
      <div
        aria-hidden="true"
        className="hero-glow pointer-events-none absolute left-1/2 top-0 size-72 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl [animation-delay:4s]"
      />

      {/* Floating cards */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {FLOATING_CARDS.map((card) => (
          <div
            key={`${card.label}-${card.className}`}
            className={`hero-float absolute grid size-20 place-items-center rounded-xl border-3 border-base-100/40 text-3xl font-black text-white shadow-2xl ${card.color} ${card.className}`}
            style={{
              animationDelay: card.delay,
              animationDuration: card.duration,
            }}
          >
            {card.label}
          </div>
        ))}
      </div>

      <div className="hero-content relative z-10 flex-col gap-8 px-4 py-16 text-center">
        <img
          src={unoLogo}
          alt="UNO"
          className="h-24 w-auto drop-shadow-[0_0_25px_rgba(255,85,85,0.45)] sm:h-32"
        />

        <div className="max-w-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.35em] text-accent">
            {WEBSITE_NAME}
          </p>
          <h1 className="mb-5 bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-5xl font-black leading-tight text-transparent sm:text-7xl">
            Play. Bluff. Win.
          </h1>
          <p className="mx-auto max-w-xl text-base text-base-content/70 sm:text-lg">
            {WEBSITE_DESCRIPTION}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <StartPlayingButton>Play now</StartPlayingButton>
          <Link to="/rules" className="btn btn-outline btn-lg">
            How to play
          </Link>
        </div>

        <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-base-content/60">
          <li className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-success" />
            Real-time multiplayer
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-accent" />
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
