import { useEffect } from "react";
import { Link } from "react-router-dom";
import { TERMS_PAGE_TITLE, WEBSITE_NAME } from "../../constants";

export function TermsPage() {
  useEffect(() => {
    document.title = `${TERMS_PAGE_TITLE} | ${WEBSITE_NAME}`;
  }, []);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <div className="card bg-base-200 shadow-xl">
        <div className="card-body gap-6">
          <header className="border-b border-base-300 pb-4">
            <h1 className="text-3xl font-bold">{TERMS_PAGE_TITLE}</h1>
            <p className="mt-1 text-sm opacity-70">
              Last updated: November 2026 — {WEBSITE_NAME}
            </p>
          </header>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
            <p className="text-sm leading-relaxed opacity-90">
              By creating an account or accessing {WEBSITE_NAME}, you agree to
              comply with these Terms of Service. If you do not agree with any
              part of these terms, please refrain from using the platform.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">
              2. Account Registration & Security
            </h2>
            <p className="text-sm leading-relaxed opacity-90">
              You must provide a valid email address and choose a unique
              username (3 to 20 characters) that does not impersonate other
              users or contain offensive language. You are responsible for
              safeguarding your password and enabling Two-Factor Authentication
              (2FA) if desired.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">
              3. Fair Play & Acceptable Use
            </h2>
            <ul className="list-disc space-y-1 pl-6 text-sm leading-relaxed opacity-90">
              <li>
                <strong>No Cheating or Exploits:</strong> Automating gameplay,
                tampering with WebSocket packets, or exploiting game logic bugs
                to manipulate ELO rankings is strictly prohibited.
              </li>
              <li>
                <strong>Respectful Communication:</strong> Harassment, hate
                speech, spam, or abusive behavior in direct messages or game
                rooms is not tolerated.
              </li>
              <li>
                <strong>Service Integrity:</strong> Attempting to disrupt
                servers, bypass rate limits, or access other users' private data
                is forbidden.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">
              4. User-Uploaded Content (Avatars)
            </h2>
            <p className="text-sm leading-relaxed opacity-90">
              You retain ownership of the avatar images you upload, provided you
              have the legal right to use them. Uploaded avatars must be in
              supported image formats (PNG, JPG, JPEG, or WebP) and must not
              contain illegal, explicit, or copyrighted material used without
              permission.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">
              5. Educational Project & Availability
            </h2>
            <p className="text-sm leading-relaxed opacity-90">
              {WEBSITE_NAME} is an educational software engineering project
              developed by nbilyj, nbarbosa, gtourdia, and kebertra. The service
              is provided “as is” without warranties of uninterrupted uptime or
              permanent data preservation beyond the project evaluation scope.
            </p>
          </section>

          <footer className="border-t border-base-300 pt-4 text-sm opacity-80">
            Learn how we handle your personal information in our{" "}
            <Link to="/privacy" className="link link-primary">
              Privacy Policy
            </Link>
            .
          </footer>
        </div>
      </div>
    </div>
  );
}
