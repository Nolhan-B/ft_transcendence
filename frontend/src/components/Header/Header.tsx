import { NavLinks } from "./components/NavLinks";
import { SiteTitle } from "./components/SiteTitle";
import { UserMenu } from "./components/UserMenu";

// A dropdown stays open while it has the focus: drop it after a choice
function closeDropdown() {
  (document.activeElement as HTMLElement | null)?.blur();
}

export function Header() {
  return (
    <div className="navbar bg-base-200 shadow-sm">
      <div className="navbar-start">
        {/* Small screens: the links are in a dropdown */}
        <div className="dropdown lg:hidden">
          <div tabIndex={0} role="button" className="btn btn-ghost btn-square">
            <svg
              aria-label="Menu"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              className="inline-block h-5 w-5 stroke-current"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </div>
          <ul
            tabIndex={0}
            className="menu dropdown-content z-50 mt-3 w-52 rounded-box bg-base-200 p-2 shadow-xl"
          >
            <NavLinks onNavigate={closeDropdown} />
          </ul>
        </div>
        <SiteTitle />
      </div>

      {/* Large screens: the links are in the middle of the navbar */}
      <div className="navbar-center hidden lg:flex">
        <ul className="menu menu-horizontal menu-lg gap-2">
          <NavLinks />
        </ul>
      </div>

      <div className="navbar-end">
        <UserMenu />
      </div>
    </div>
  );
}
