import { useEffect } from "react";
import { Link } from "react-router-dom";
import { PRIVACY_PAGE_TITLE, WEBSITE_NAME } from "../../constants";

export function PrivacyPage() {
  useEffect(() => {
    document.title = `${PRIVACY_PAGE_TITLE} | ${WEBSITE_NAME}`;
  }, []);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <div className="card bg-base-200 shadow-xl">
        <div className="card-body gap-6">
          <header className="border-b border-base-300 pb-4">
            <h1 className="text-3xl font-bold">{PRIVACY_PAGE_TITLE}</h1>
            <p className="mt-1 text-sm opacity-70">
              Last updated: November 2026 — {WEBSITE_NAME}
            </p>
          </header>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">1. Overview</h2>
            <p className="text-sm leading-relaxed opacity-90">
              {WEBSITE_NAME} is an online multiplayer card game platform created
              as part of the 42 curriculum. We respect your privacy and only
              collect the minimum personal data required to authenticate your
              account, run real-time matches, and provide social features.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">2. Data We Collect</h2>
            <ul className="list-disc space-y-1 pl-6 text-sm leading-relaxed opacity-90">
              <li>
                <strong>Account Credentials:</strong> Email address, unique
                username, salted and hashed password, and optional Two-Factor
                Authentication (2FA) configuration secrets.
              </li>
              <li>
                <strong>Profile Information:</strong> User-uploaded profile
                avatars (PNG, JPG, JPEG, or WebP) and account creation date.
              </li>
              <li>
                <strong>Gameplay & Matchmaking Data:</strong> Match history,
                game results, ELO rating, and room participation records.
              </li>
              <li>
                <strong>Social & Chat Data:</strong> Friend list relationships,
                pending friend requests, and direct or in-game chat messages
                transmitted over WebSockets.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">
              3. Cookies & Authentication Tokens
            </h2>
            <p className="text-sm leading-relaxed opacity-90">
              We use strictly necessary session cookies (JSON Web Tokens) to
              keep you signed in across HTTP requests and WebSocket connections.
              We do not use third-party advertising trackers or analytics
              cookies.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">
              4. How We Use & Protect Your Data
            </h2>
            <p className="text-sm leading-relaxed opacity-90">
              Your data is stored in an isolated PostgreSQL database and used
              exclusively to operate the game, display leaderboards, and deliver
              real-time chat messages. All external traffic is encrypted via
              HTTPS, passwords are never stored in plain text, and uploaded
              files are validated for type and size before storage.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">
              5. Data Sharing & Retention
            </h2>
            <p className="text-sm leading-relaxed opacity-90">
              We do not sell, rent, or share your personal data with third
              parties. Your public profile (username, avatar, ELO, and match
              statistics) is visible to other registered players on the
              platform. Data is retained only while your account remains active
              or for the duration of the academic evaluation period.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">6. Your Rights</h2>
            <p className="text-sm leading-relaxed opacity-90">
              In accordance with GDPR principles, you may view and update your
              username, avatar, and security settings at any time from your{" "}
              <Link to="/profile" className="link link-primary">
                Profile
              </Link>{" "}
              or{" "}
              <Link to="/settings" className="link link-primary">
                Settings
              </Link>{" "}
              page, or request the deletion of your account and associated data
              by contacting the project maintainers listed in the footer.
            </p>
          </section>

          <footer className="border-t border-base-300 pt-4 text-sm opacity-80">
            See also our{" "}
            <Link to="/terms" className="link link-primary">
              Terms of Service
            </Link>
            .
          </footer>
        </div>
      </div>
    </div>
  );
}
