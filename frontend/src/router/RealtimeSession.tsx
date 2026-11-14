import { Outlet } from "react-router-dom";
import { ChatProvider } from "../context/ChatProvider";
import { GameProvider } from "../context/GameProvider";
import { useAuth } from "../hooks/auth/useAuth";

// Wraps every page: a connected user gets one game WebSocket and one chat
// WebSocket for the whole visit, so going to a public page (home, rules...)
// does not cut a game in progress. A visitor opens no socket (the servers
// would refuse it).
export function RealtimeSession() {
  const { user } = useAuth();
  return user ? (
    <GameProvider>
      <ChatProvider>
        <Outlet />
      </ChatProvider>
    </GameProvider>
  ) : (
    <Outlet />
  );
}
