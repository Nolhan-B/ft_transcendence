import { Link } from "react-router-dom";
import {
  AUTH_PAGE_TITLE,
  GAME_PAGE_TITLE,
  HOME_PAGE_TITLE,
  LEGAL_PAGE_TITLE,
  PROFILE_PAGE_TITLE,
  TERMS_PAGE_TITLE,
} from "../../../constants";

export function Drawer() {
  return (
    <div className="drawer">
      <input id="my-drawer-1" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content">
        {/* Page content here */}
        <label htmlFor="my-drawer-1" className="btn drawer-button">
          <svg
            aria-label="Menu"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            className="inline-block h-5 w-5 stroke-current"
          >
            {" "}
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 6h16M4 12h16M4 18h16"
            ></path>{" "}
          </svg>
        </label>
      </div>
      <div className="drawer-side">
        <label
          htmlFor="my-drawer-1"
          aria-label="close sidebar"
          className="drawer-overlay"
        ></label>
        <ul className="menu bg-base-200 min-h-full w-80 p-4">
          {/* Sidebar content here */}
          <li>
            <Link to="/home">{HOME_PAGE_TITLE}</Link>
          </li>
          <li>
            <Link to="/auth">{AUTH_PAGE_TITLE}</Link>
          </li>
          <li>
            <Link to="/game">{GAME_PAGE_TITLE}</Link>
          </li>
          <li>
            <Link to="/legal">{LEGAL_PAGE_TITLE}</Link>
          </li>
          <li>
            <Link to="/profile">{PROFILE_PAGE_TITLE}</Link>
          </li>
          <li>
            <Link to="/terms">{TERMS_PAGE_TITLE}</Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
