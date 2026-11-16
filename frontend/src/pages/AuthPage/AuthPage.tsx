import { useState } from "react";
import { Link } from "react-router-dom";
import { LoginForm } from "../../components/authentification/LoginForm";
import { TwoFactorForm } from "../../components/authentification/TwoFactorForm";
import { useAuth } from "../../hooks/auth/useAuth";
import { Hand } from "../../components/cards/Hand";
import type { HandCard } from "../../components/cards/Hand";
import { RegisterForm } from "../../components/authentification/RegisterForm";

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
  const [selected, setSelected] = useState(FRONT);
  const { twoFactorPending } = useAuth();

  // A starting UNO hand: 7 cards alternating sign-in / sign-up. Every card
  // is usable, the front one shows the form. Content only on the front card,
  // so the hidden forms are never focusable.
  const cards: HandCard[] = Array.from({ length: HAND_SIZE }, (_, i) => {
    const mode = modeOf(i);
    return {
      id: `card-${i}`,
      color: mode === "login" ? "primary" : "secondary",
      label: mode === "login" ? "Switch to Sign-in" : "Switch to Sign-up",
      content:
        i !== selected ? undefined : mode === "login" ? (
          twoFactorPending ? (
            <TwoFactorForm />
          ) : (
            <LoginForm />
          )
        ) : (
          // <p className="text-center">Sign-up form coming soon</p>
          <RegisterForm />
        ),
    };
  });

  return (
    <div className="flex flex-1">
      {/* Left half: empty for now (darkest theme surface) */}
      <section className="hidden md:block md:w-1/2 bg-base-300" />

      {/* Right half: hand of cards (lighter theme surface) */}
      <section className="relative flex w-full md:w-1/2 items-center justify-center overflow-hidden bg-base-100 px-4">
        {/* Rays coming out of the hand's pivot point (decorative) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[repeating-conic-gradient(from_0deg_at_50%_80%,color-mix(in_oklab,var(--color-base-content)_6%,transparent)_0deg_6deg,transparent_6deg_12deg)]"
        />

        <Link to="/home" className="btn btn-accent absolute right-4 top-4 z-20">
          Go to website
        </Link>

        {/* Visible switch, in sync with the front card. Pinned in a corner and
            above the cards (z-20): the fan swings out of its box and would
            otherwise cover it. */}
        <div className="join absolute left-4 top-4 z-20">
          {MODES.map(({ mode, label, activeClass }) => (
            <button
              key={mode}
              type="button"
              aria-pressed={modeOf(selected) === mode}
              onClick={() => setSelected(cardOf(mode))}
              className={`btn join-item ${
                modeOf(selected) === mode ? activeClass : ""
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
          onSelect={(id) => setSelected(Number(id.slice(5)))}
        />
        <nav className="absolute inset-x-0 bottom-4 z-20 flex justify-center pointer-events-none gap-6 text-sm">
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
