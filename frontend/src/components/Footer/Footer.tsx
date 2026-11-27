import { Link } from "react-router-dom";
import { WEBSITE_DESCRIPTION, WEBSITE_NAME } from "../../constants";
import { BrandLogo } from "../texts/BrandLogo";

export function Footer() {
  return (
    <div className="relative border-t border-white/10 bg-black/30 backdrop-blur-sm">
      {/* The four UNO colors along the top edge */}
      <div aria-hidden="true" className="flex h-1 w-full">
        <span className="flex-1 bg-primary" />
        <span className="flex-1 bg-accent" />
        <span className="flex-1 bg-success" />
        <span className="flex-1 bg-secondary" />
      </div>
      <footer className="footer sm:footer-horizontal text-base-content p-10">
        <aside>
          <BrandLogo size="md" className="mb-2" />
          <p className="text-base-content/75">
            <span className="font-bold text-white">{WEBSITE_NAME}</span> © 2026
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
