import { Outlet } from "react-router-dom";
import { BackToGame } from "../components/game/BackToGame";
import { TableBackground } from "../components/layout/TableBackground";
import { Header } from "../components/Header/Header";
import { DebugHeader } from "../components/DebugHeader/DebugHeader";
import { SideButton } from "../components/SideButton/SideButton";

// Layout of the game pages: like the main layout, without the footer. On a
// landscape phone (short screen) the navbar is hidden too, the board needs
// every pixel of height.
export function GameLayout() {
  return (
    <div className="isolate flex min-h-dvh flex-col text-base-content">
      {/* Red card table behind every page */}
      <TableBackground />
      {/* Dev-only: `VITE_DEBUG_HEADER=false` hides it, prod build strips it */}
      {import.meta.env.DEV && import.meta.env.VITE_DEBUG_HEADER !== "false" && (
        <DebugHeader />
      )}

      <div className="snug:hidden">
        <Header />
      </div>
      <main className="container mx-auto flex flex-1 flex-col px-4 py-4 compact:py-2 snug:py-1 short:px-2 tiny:py-1 phone:px-2">
        <Outlet />
      </main>
      {/* Spectating: the way back to my own game, if I play one */}
      <BackToGame />
      {/* On a small landscape phone the button covers the right seat */}
      <div className="tiny:hidden">
        <SideButton />
      </div>
    </div>
  );
}
