import { Outlet } from "react-router-dom";
import { Header } from "../components/Header/Header";
import { DebugHeader } from "../components/DebugHeader/DebugHeader";
import { SideButton } from "../components/SideButton/SideButton";

// Layout of the game pages: like the main layout, without the footer. On a
// landscape phone (short screen) the navbar is hidden too, the board needs
// every pixel of height.
export function GameLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-base-100 text-base-content">
      {/* Dev-only: `VITE_DEBUG_HEADER=false` hides it, prod build strips it */}
      {import.meta.env.DEV && import.meta.env.VITE_DEBUG_HEADER !== "false" && (
        <DebugHeader />
      )}

      <div className="snug:hidden">
        <Header />
      </div>
      <main className="container mx-auto flex flex-1 flex-col px-4 py-4 compact:py-2 snug:py-1 short:px-2 tiny:py-1">
        <Outlet />
      </main>
      {/* On a small landscape phone the button covers the right seat */}
      <div className="tiny:hidden">
        <SideButton />
      </div>
    </div>
  );
}
