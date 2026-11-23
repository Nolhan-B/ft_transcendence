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
    // Deep dark canvas with a subtle masked cyber grid instead of conic rays
    <div className="relative flex flex-1 overflow-hidden bg-base-300">
      {/* Subtle perspective-free cyber grid faded out toward the viewport edges */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(0, 240, 255, 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 240, 255, 0.06) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse 85% 80% at 50% 50%, #000 35%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 85% 80% at 50% 50%, #000 35%, transparent 100%)",
        }}
      />

      {/* Ambient corner glows to add depth behind both columns */}
      <div
        aria-hidden="true"
        className="hero-glow pointer-events-none absolute -left-32 top-1/3 size-[28rem] rounded-full bg-[#00f0ff]/12 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="hero-glow pointer-events-none absolute -right-24 bottom-1/4 size-[26rem] rounded-full bg-[#ff2a85]/14 blur-3xl [animation-delay:2s]"
      />

      {/* Top-right navigation shortcut */}
      <Link
        to="/home"
        className="btn btn-outline btn-sm font-cyber absolute right-4 top-4 z-20 border-[#00f0ff]/50 text-[#00f0ff] hover:border-[#00f0ff] hover:bg-[#00f0ff]/15"
      >
        Go to website
      </Link>

      {/* Left half: large focal SNS emblem and headline */}
      <section className="relative z-10 hidden md:flex md:w-1/2 md:flex-col md:items-center md:justify-center md:px-10">
        <div className="relative flex w-full max-w-xl flex-col items-center gap-7 text-center">
          {/* Focused neon backlight directly behind the logo */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1/3 left-1/2 -z-10 h-64 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-[#00f0ff]/25 via-[#a855f7]/25 to-[#ff2a85]/25 blur-3xl"
          />

          <img
            src={snsLogo}
            alt="SNS"
            className="h-auto w-[360px] max-w-[90%] drop-shadow-[0_0_24px_rgba(0,240,255,0.35)] lg:w-[460px] xl:w-[520px]"
          />

          <div>
            <p className="font-cyber mb-3 text-2xl font-extrabold uppercase tracking-[0.3em] text-[#00f0ff] drop-shadow-[0_0_10px_rgba(0,240,255,0.5)] lg:text-3xl">
              {WEBSITE_NAME}
            </p>
            <h1 className="font-cyber mb-4 bg-gradient-to-r from-[#00f0ff] via-[#a855f7] to-[#ff2a85] bg-clip-text text-4xl font-black uppercase tracking-tight text-transparent drop-shadow-[0_0_14px_rgba(168,85,247,0.3)] lg:text-5xl">
              Play. Bluff. Win.
            </h1>
            <p className="mx-auto max-w-md text-sm text-base-content/70 lg:text-base">
              {WEBSITE_DESCRIPTION}
            </p>
          </div>

          <ul className="mt-1 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-base-content/65 lg:text-sm">
            <li className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#00f0ff]" />
              Real-time multiplayer
            </li>
            <li className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#a855f7]" />
              Ranked Elo
            </li>
            <li className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#ff2a85]" />
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
              className={`btn btn-sm font-cyber join-item uppercase tracking-wider ${
                modeOf(selected) === mode
                  ? activeClass
                  : "border-base-300 bg-base-200/80 text-base-content/70 hover:text-base-content"
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

        <nav className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center gap-6 text-sm text-base-content/60">
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
