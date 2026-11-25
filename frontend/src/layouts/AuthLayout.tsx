import { Outlet } from "react-router-dom";
import { TableBackground } from "../components/layout/TableBackground";
import { DebugHeader } from "../components/DebugHeader/DebugHeader";

export function AuthLayout() {
  return (
    <div className="isolate flex flex-col min-h-screen flex text-base-content">
      {/* Red card table behind every page */}
      <TableBackground />
      {/* Dev-only, like the other layouts: the prod build strips it */}
      {import.meta.env.DEV && import.meta.env.VITE_DEBUG_HEADER !== "false" && (
        <DebugHeader />
      )}
      <Outlet />
    </div>
  );
}
