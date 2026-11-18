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

      <div className="short:hidden">
        <Header />
      </div>
      <main className="container mx-auto flex-1 px-4 py-4 short:px-2 short:py-2">
        <Outlet />
      </main>
      <SideButton />
    </div>
  );
}
