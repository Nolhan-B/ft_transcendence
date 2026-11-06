import { WEBSITE_NAME } from "../../../constants";
import { Link } from "react-router-dom";

export function SiteTitle() {
  return (
    <Link to="/" className="btn btn-ghost text-xl">
      {WEBSITE_NAME}
    </Link>
  );
}
