import { useAuth } from "../../hooks/auth/useAuth";
import { Drawer } from "./components/Drawer";
import { SiteTitle } from "./components/SiteTitle";
import { UserProfileIcon } from "./components/UserProfileIcon";

export function Header() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="navbar bg-base-200 shadow-sm">
        <div className="flex-none">
          <Drawer />
        </div>
        <div className="flex-1">
          <SiteTitle />
        </div>
      </div>
    );
  }
  return (
    <div className="navbar bg-base-200 shadow-sm">
      <div className="flex-1">
        <SiteTitle />
      </div>
      <div className="flex-none">
        <UserProfileIcon />
      </div>
    </div>
  );
}
