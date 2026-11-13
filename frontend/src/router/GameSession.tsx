import { Outlet } from "react-router-dom";
import { GameProvider } from "../context/GameProvider";
import { useAuth } from "../hooks/auth/useAuth";

// Wraps every page: a connected user gets one WebSocket for the whole visit,
// so going to a public page (home, rules...) does not cut a game in progress.
// A visitor opens no socket (the server would answer "Unauthorized").
export function GameSession() {
  const { user } = useAuth();
  return user ? (
    <GameProvider>
      <Outlet />
    </GameProvider>
  ) : (
    <Outlet />
  );
}
