import { Outlet } from "react-router-dom";

export function AuthLayout() {
  return (
    <div className="min-h-screen flex bg-base-100 text-base-content">
      <Outlet />
    </div>
  );
}
