import { Link } from "react-router-dom";
import { BrandLogo } from "../../texts/BrandLogo";
import { BrandName } from "../../texts/BrandName";

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
      <BrandName size="sm" className="hidden min-[360px]:inline-block" />
    </Link>
  );
}
