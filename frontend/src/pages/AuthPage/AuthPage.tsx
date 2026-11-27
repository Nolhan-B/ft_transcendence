import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LoginForm } from "../../components/authentification/LoginForm";
import { TwoFactorForm } from "../../components/authentification/TwoFactorForm";
import { useAuth } from "../../hooks/auth/useAuth";
import { Hand } from "../../components/cards/Hand";
import type { HandCard } from "../../components/cards/Hand";
import { RegisterForm } from "../../components/authentification/RegisterForm";
import { BrandLogo } from "../../components/texts/BrandLogo";
import { WEBSITE_DESCRIPTION } from "../../constants";
import { BrandName } from "../../components/texts/BrandName";

type Mode = "login" | "register";

const HAND_SIZE = 7;
const FRONT = HAND_SIZE - 1; // base card of the fan, in front at the start

// Cards alternate sign-in / sign-up, the base card being a sign-in
const modeOf = (index: number): Mode =>
  (FRONT - index) % 2 === 0 ? "login" : "register";

// Card brought to the front by a button: the one of that mode closest to the base
const cardOf = (mode: Mode): number =>
  Array.from({ length: HAND_SIZE }, (_, i) => i)
    .filter((i) => modeOf(i) === mode)
    .sort((a, b) => Math.abs(a - FRONT) - Math.abs(b - FRONT))[0];

const MODES: { mode: Mode; label: string }[] = [
  { mode: "login", label: "Sign-in" },
  { mode: "register", label: "Sign-up" },
];

export function AuthPage() {
  // /auth?mode=register opens on the sign-up card (navbar "Sign up" button)
  const [searchParams] = useSearchParams();
  const [selected, setSelected] = useState(
    searchParams.get("mode") === "register" ? cardOf("register") : FRONT,
  );
  const { twoFactorPending } = useAuth();

  // A starting hand: 7 cards alternating sign-in / sign-up. The front card
  // holds the form, the others only say what they open.
  const cards: HandCard[] = Array.from({ length: HAND_SIZE }, (_, i) => {
    const mode = modeOf(i);
    return {
      id: `card-${i}`,
      color: mode === "login" ? "primary" : "secondary",
      label: mode === "login" ? "Switch to Sign-in" : "Switch to Sign-up",
      content:
        i !== selected ? (
          <span className="text-display block -rotate-12 text-center text-[16cqw] leading-tight">
            {mode === "login" ? "Sign in" : "Sign up"}
          </span>
        ) : (
          <div className="px-[7cqw] py-[6cqw] text-base-content">
            {mode === "login" ? (
              twoFactorPending ? (
                <TwoFactorForm />
              ) : (
                <LoginForm />
              )
            ) : (
              <RegisterForm />
            )}
          </div>
        ),
    };
  });

  return (
    <div className="relative flex flex-1 overflow-hidden">
      {/* Top-right navigation shortcut */}
      <Link to="/home" className="btn btn-sm absolute top-4 right-4 z-20">
        Go to website
      </Link>

      {/* Left half: the logo and the headline */}
      <section className="relative z-10 hidden md:flex md:w-1/2 md:flex-col md:items-center md:justify-center md:px-10">
        <div className="relative flex w-full max-w-xl flex-col items-center gap-8 text-center">
          <div
            aria-hidden="true"
            className="hero-glow pointer-events-none absolute top-1/4 left-1/2 -z-10 size-96 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl"
          />

          <BrandLogo size="xl" className="animate-pop" />

          <div>
            <p className="mb-4">
              <BrandName size="lg" />
            </p>
            <h1 className="text-display mb-4 text-5xl lg:text-6xl">
              Play. <span className="text-accent">Bluff.</span>{" "}
              <span className="text-success">Win.</span>
            </h1>
            <p className="mx-auto max-w-md text-sm text-white/75 lg:text-base">
              {WEBSITE_DESCRIPTION}
            </p>
          </div>

          <ul className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold lg:text-sm">
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

      {/* Right half: the hand of cards, the front one holds the form */}
      <section className="relative z-10 flex w-full flex-col items-center justify-center px-4 md:w-1/2">
        {/* Visible switch synced with the front card */}
        <div className="absolute top-4 left-4 z-20 flex gap-1 rounded-full bg-black/35 p-1">
          {MODES.map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              aria-pressed={modeOf(selected) === mode}
              onClick={() => setSelected(cardOf(mode))}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                modeOf(selected) === mode
                  ? "bg-white text-ink"
                  : "text-white/70 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <Hand
          cards={cards}
          selectedId={`card-${selected}`}
          step={5}
          fan="left"
          // No "w-full" from the "sm" breakpoint: from 768px the section is only
          // half of the screen, the fan would overflow it
          className="w-2/3 max-w-[max(14rem,min(24rem,calc((100dvh_-_9rem)*56/87)))]"
          onSelect={(id) => setSelected(Number(id.slice(5)))}
        />

        <nav className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center gap-6 text-sm text-white/60">
          <Link to="/terms" className="link link-hover pointer-events-auto">
            Terms of Service
          </Link>
          <Link to="/privacy" className="link link-hover pointer-events-auto">
            Privacy Policy
          </Link>
        </nav>
      </section>
    </div>
  );
}
