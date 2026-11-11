import { WEBSITE_NAME } from "../../../constants";
import { Link } from "react-router-dom";
import unoLogo from "../../../assets/images/uno-logo.svg?url"

export function SiteTitle() {
  return (
    <Link to="/" className="btn btn-ghost text-xl gap-3">
        <img src={unoLogo} alt="UNO" className="h-8 w-8" />
      {WEBSITE_NAME}
    </Link>
  );
}
