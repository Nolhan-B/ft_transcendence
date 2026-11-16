import { Outlet } from "react-router-dom";
import { DebugHeader } from "../components/DebugHeader/DebugHeader";

export function AuthLayout() {
  return (
    <div className="flex flex-col min-h-screen flex bg-base-100 text-base-content">
      <DebugHeader />
      <Outlet />
    </div>
  );
}
