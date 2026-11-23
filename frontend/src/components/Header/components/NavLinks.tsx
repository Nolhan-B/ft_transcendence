import { NavLink } from "react-router-dom";
import { useAuth } from "../../../hooks/auth/useAuth";

// Pages of the website; "auth" ones are only shown to a connected user
const LINKS = [
  { to: "/home", label: "Home", auth: false },
  { to: "/play", label: "Play", auth: true },
  { to: "/leaderboard", label: "Leaderboard", auth: false },
  { to: "/rules", label: "Rules", auth: false },
];

interface Props {
  onNavigate?: () => void;
}

// <li> items with cyberpunk display typography for navbar or dropdown menus
export function NavLinks({ onNavigate }: Props) {
  const { user } = useAuth();

  return (
    <>
      {LINKS.filter((link) => !link.auth || user).map(({ to, label }) => (
        <li key={to}>
          <NavLink
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `font-cyber text-xs font-bold uppercase tracking-wider sm:text-sm ${
                isActive
                  ? "menu-active border-b-2 border-secondary bg-neutral text-secondary"
                  : "hover:bg-base-300 hover:text-secondary"
              }`
            }
          >
            {label}
          </NavLink>
        </li>
      ))}
    </>
  );
}
