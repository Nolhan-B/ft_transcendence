import { useEffect } from "react";
import { ErrorAlert } from "../ui/ErrorAlert";
import { useChat } from "../../hooks/ws/useChat";
import { useGame } from "../../hooks/ws/useGame";

const DURATION_MS = 5000;

// One toast: disappears alone after a few seconds, or on click
function ErrorToast({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, DURATION_MS);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  return <ErrorAlert message={message} onClose={onClose} />;
}

// Shows the errors sent by the game and chat servers (bottom right corner)
export function RealtimeErrors() {
  const game = useGame();
  const chat = useChat();

  if (!game.error && !chat.error) return null;

  return (
    <div className="toast toast-end toast-bottom z-50">
      {game.error && (
        <ErrorToast message={game.error} onClose={game.clearError} />
      )}
      {chat.error && (
        <ErrorToast message={chat.error} onClose={chat.clearError} />
      )}
    </div>
  );
}
