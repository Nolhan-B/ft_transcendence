import { Outlet } from "react-router-dom";
import { TableBackground } from "../components/layout/TableBackground";
import { DebugHeader } from "../components/DebugHeader/DebugHeader";

export function AuthLayout() {
  return (
    <div className="isolate flex flex-col min-h-screen flex text-base-content">
      {/* Red card table behind every page */}
      <TableBackground />
      <DebugHeader />
      <Outlet />
    </div>
  );
}
