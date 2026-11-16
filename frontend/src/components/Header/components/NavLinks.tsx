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

// <li> items, to put in a daisyUI "menu" (the navbar center or a dropdown)
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
              `font-semibold ${
                isActive
                  ? "menu-active border-b-2 border-accent bg-neutral text-neutral-content"
                  : "hover:bg-base-300"
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
