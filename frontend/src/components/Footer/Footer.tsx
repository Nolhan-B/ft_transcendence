import { Link } from "react-router-dom";
import { WEBSITE_DESCRIPTION, WEBSITE_NAME } from "../../constants";
import snsLogo from "../../assets/images/sns-logo.svg?url";

export function Footer() {
  return (
    <div className="relative bg-base-200">
      {/* Subtle neon gradient divider along the top edge */}
      <div
        aria-hidden="true"
        className="h-px w-full bg-gradient-to-r from-transparent via-tertiary/60 to-transparent"
      />
      <footer className="footer sm:footer-horizontal text-base-content p-10">
        <aside>
          <img
            src={snsLogo}
            alt="SNS"
            className="mb-1 h-10 w-auto drop-shadow-[0_0_8px_color-mix(in_oklab,var(--color-secondary)_30%,transparent)]"
          />
          <p className="text-base-content/75">
            <span className="font-cyber bg-gradient-to-r from-secondary via-tertiary to-primary bg-clip-text font-extrabold tracking-wider text-transparent">
              {WEBSITE_NAME}
            </span>{" "}
            © 2026
            <br />
            {WEBSITE_DESCRIPTION}
          </p>
        </aside>
        <nav>
          <h6 className="footer-title">LEGAL</h6>
          <Link className="link link-hover" to="/terms">
            Terms of Service
          </Link>
          <Link className="link link-hover" to="/privacy">
            Privacy Policy
          </Link>
        </nav>
        <nav>
          <h6 className="footer-title">NAVIGATION</h6>
          <Link className="link link-hover" to="/rules">
            Rules
          </Link>
          <Link className="link link-hover" to="/settings">
            Settings
          </Link>
          <Link className="link link-hover" to="/leaderboard">
            Leaderboard
          </Link>
        </nav>
        <nav>
          <h6 className="footer-title">GITHUB LINKS</h6>
          <a
            className="link link-hover"
            href="https://github.com/Nolhan-B"
            target="_blank"
            rel="noopener noreferrer"
          >
            nbilyj
          </a>
          <a
            className="link link-hover"
            href="https://github.com/nicobrb68"
            target="_blank"
            rel="noopener noreferrer"
          >
            nbarbosa
          </a>
          <a
            className="link link-hover"
            href="https://github.com/sousampere"
            target="_blank"
            rel="noopener noreferrer"
          >
            gtourdia
          </a>
          <a
            className="link link-hover"
            href="https://github.com/KeroBeros68"
            target="_blank"
            rel="noopener noreferrer"
          >
            kebertra
          </a>
        </nav>
      </footer>
    </div>
  );
}
