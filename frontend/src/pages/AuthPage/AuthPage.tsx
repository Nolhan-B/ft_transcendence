import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LoginForm } from "../../components/authentification/LoginForm";
import { TwoFactorForm } from "../../components/authentification/TwoFactorForm";
import { useAuth } from "../../hooks/auth/useAuth";
import { Hand } from "../../components/cards/Hand";
import type { HandCard } from "../../components/cards/Hand";
import { RegisterForm } from "../../components/authentification/RegisterForm";
import snsLogo from "../../assets/images/sns-logo.svg?url";
import { WEBSITE_DESCRIPTION, WEBSITE_NAME } from "../../constants";

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

const MODES: { mode: Mode; label: string; activeClass: string }[] = [
  { mode: "login", label: "Sign-in", activeClass: "btn-primary" },
  { mode: "register", label: "Sign-up", activeClass: "btn-secondary" },
];

export function AuthPage() {
  // /auth?mode=register opens on the sign-up card (navbar "Sign up" button)
  const [searchParams] = useSearchParams();
  const [selected, setSelected] = useState(
    searchParams.get("mode") === "register" ? cardOf("register") : FRONT,
  );
  const { twoFactorPending } = useAuth();

  // A starting hand: 7 neon cards alternating sign-in / sign-up. Content is
  // wrapped with neutral text color and padding to sit cleanly inside the neon tube.
  const cards: HandCard[] = Array.from({ length: HAND_SIZE }, (_, i) => {
    const mode = modeOf(i);
    return {
      id: `card-${i}`,
      color: mode === "login" ? "primary" : "secondary",
      label: mode === "login" ? "Switch to Sign-in" : "Switch to Sign-up",
      content:
        i !== selected ? undefined : (
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
    // Transparent container so the full-screen Miami CityBackground from AuthLayout shows through
    <div className="relative flex flex-1 overflow-hidden">
      {/* Top-right navigation shortcut */}
      <Link
        to="/home"
        className="btn btn-sm font-hotline absolute right-4 top-4 z-20 border-2 border-secondary bg-base-300/75 font-bold italic uppercase tracking-wider text-secondary shadow-[3px_3px_0px_var(--color-primary)] backdrop-blur-sm transition-transform duration-150 hover:-translate-y-0.5 hover:border-secondary hover:bg-secondary hover:text-base-300"
      >
        Go to website
      </Link>

      {/* Left half: large focal SNS emblem and Miami Vice / Hotline Miami headline */}
      <section className="relative z-10 hidden md:flex md:w-1/2 md:flex-col md:items-center md:justify-center md:px-10">
        <div className="relative flex w-full max-w-xl flex-col items-center gap-6 text-center">
          <img
            src={snsLogo}
            alt="SNS"
            className="h-auto w-[340px] max-w-[90%] drop-shadow-[0_0_24px_rgba(0,240,255,0.45)] lg:w-[420px] xl:w-[480px]"
          />

          <div>
            <p className="font-miami mb-2 -rotate-2 text-4xl tracking-wide text-secondary drop-shadow-[0_0_12px_rgba(0,240,255,0.7)] lg:text-5xl">
              {WEBSITE_NAME}
            </p>
            <h1 className="font-hotline mb-4 bg-gradient-to-r from-accent via-sunset to-primary bg-clip-text text-5xl font-bold italic uppercase tracking-tight leading-none text-transparent drop-shadow-[4px_4px_0px_rgba(11,6,23,0.9)] lg:text-6xl">
              Play. Bluff. Win.
            </h1>
            <p className="mx-auto max-w-md rounded-full border border-primary/25 bg-base-300/70 px-5 py-2 text-sm text-base-content/90 backdrop-blur-sm lg:text-base">
              {WEBSITE_DESCRIPTION}
            </p>
          </div>

          <ul className="mt-1 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-base-content/85 lg:text-sm">
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
              Friends & chat
            </li>
          </ul>
        </div>
      </section>

      {/* Right half: interactive neon card fan */}
      <section className="relative z-10 flex w-full flex-col items-center justify-center px-4 md:w-1/2">
        {/* Visible switch synced with the front card */}
        <div className="join absolute left-4 top-4 z-20">
          {MODES.map(({ mode, label, activeClass }) => (
            <button
              key={mode}
              type="button"
              aria-pressed={modeOf(selected) === mode}
              onClick={() => setSelected(cardOf(mode))}
              className={`btn btn-sm font-hotline join-item font-bold italic uppercase tracking-wider ${
                modeOf(selected) === mode
                  ? activeClass
                  : "border-base-300 bg-base-300/75 text-base-content/75 backdrop-blur-sm hover:text-base-content"
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
          variant="neon"
          // No "w-full" from the "sm" breakpoint: from 768px the section is only
          // half of the screen, the fan would overflow it
          className="w-2/3 max-w-[max(14rem,min(24rem,calc((100dvh_-_9rem)*56/87)))]"
          onSelect={(id) => setSelected(Number(id.slice(5)))}
        />

        <nav className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center gap-6 text-sm text-base-content/75">
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
