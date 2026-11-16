import { WEBSITE_NAME } from "../../../constants";
import { Link } from "react-router-dom";
import unoLogo from "../../../assets/images/uno-logo.svg?url";

export function SiteTitle() {
  return (
    <Link
      to="/"
      className="btn btn-ghost gap-3 border-transparent text-xl shadow-none transition-transform duration-200 hover:scale-105 hover:border-transparent hover:bg-transparent active:scale-95"
    >
      <img src={unoLogo} alt="UNO" className="h-8 w-8" />
      <span className="hidden sm:inline">{WEBSITE_NAME}</span>
    </Link>
  );
}
