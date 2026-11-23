import { WEBSITE_NAME } from "../../../constants";
import { Link } from "react-router-dom";
import snsLogo from "../../../assets/images/sns-logo.svg?url";

// Header brand link displaying the SNS emblem and cyberpunk site name
export function SiteTitle() {
  return (
    <Link
      to="/"
      className="btn btn-ghost gap-3 border-transparent text-xl shadow-none transition-transform duration-200 hover:scale-105 hover:border-transparent hover:bg-transparent active:scale-95"
    >
      <img
        src={snsLogo}
        alt="SNS"
        className="h-8 w-auto drop-shadow-[0_0_8px_color-mix(in_oklab,var(--color-secondary)_30%,transparent)]"
      />
      <span className="font-cyber hidden bg-gradient-to-r from-secondary via-tertiary to-primary bg-clip-text text-lg font-extrabold tracking-wider text-transparent sm:inline">
        {WEBSITE_NAME}
      </span>
    </Link>
  );
}
