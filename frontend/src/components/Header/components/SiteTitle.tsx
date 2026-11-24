import { WEBSITE_NAME } from "../../../constants";
import { Link } from "react-router-dom";
import { BrandLogo } from "../../texts/BrandLogo";

// Header brand link: the SNS badge and the name of the site
export function SiteTitle() {
  return (
    <Link
      to="/"
      className="group flex items-center gap-3 px-2 transition-transform duration-200 hover:scale-105 active:scale-95"
    >
      <BrandLogo
        size="sm"
        className="transition-transform duration-300 group-hover:rotate-4"
      />
      <span className="hidden text-lg font-bold tracking-wide sm:inline">
        {WEBSITE_NAME}
      </span>
    </Link>
  );
}
