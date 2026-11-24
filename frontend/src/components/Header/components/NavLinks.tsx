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

// <li> items for the navbar or the dropdown menu: the current page is a
// yellow pill
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
              `rounded-full text-sm font-semibold sm:text-base ${
                isActive
                  ? "menu-active bg-accent! text-accent-content!"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
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
