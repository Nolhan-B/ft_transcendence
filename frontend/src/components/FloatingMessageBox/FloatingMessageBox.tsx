import { useEffect, useRef, useState } from "react";
import messageIcon from "../../assets/icons/message.svg";
import { useAuth } from "../../hooks/auth/useAuth";
import { useGame } from "../../hooks/ws/useGame";

// Floating button in the bottom-right corner of the game pages. It opens the
// chat of the game in progress: the messages exchanged over the game
// WebSocket (see useGame / GameProvider).
export function FloatingMessageBox() {
  const { user } = useAuth();
  const { status, gameId, chatMessages, sendChatMessage } = useGame();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [notify, setNotify] = useState(false);
  // The scrollable list of messages, scrolled down when a message arrives
  const listRef = useRef<HTMLDivElement | null>(null);

  // A new message: show it by scrolling the list to the bottom
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [chatMessages.length, open]);

  // Escape closes the panel, like the other drawers of the app
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // The server only accepts a message on an open socket and in a game.
  // sendChatMessage() silently does nothing otherwise, so we block the input.
  const canSend = status === "open" && gameId !== null;
  const text = draft.trim();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (text === "" || !canSend) return;
    sendChatMessage(text);
    setDraft("");
  }

  // handle bubble color depending on new messages appearing
  useEffect(() => {
    if (open) {
      setNotify(false);
    }
  }, [open]);
  useEffect(() => {
    if (open) {
      return;
    }
    if (chatMessages.length != 0) {
      setNotify(true);
    }
  }, [chatMessages.length]);

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      {open && (
        <div
          className="flex h-[26rem] max-h-[calc(100dvh-8rem)] w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-xl"
          aria-label="Game chat"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-base-300 px-4 py-2">
            <h2 className="font-cyber text-sm font-bold uppercase tracking-wider">
              Game chat
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close game chat"
              className="btn btn-ghost btn-xs"
            >
              ✕
            </button>
          </div>

          <div
            ref={listRef}
            className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-4"
            aria-live="polite"
          >
            {chatMessages.length === 0 ? (
              <p className="my-auto text-center text-sm opacity-60">
                {gameId
                  ? "No messages yet. Say hi!"
                  : "Join a game to chat with the other players."}
              </p>
            ) : (
              // The server sends no id for these messages and the list only
              // grows, so the position is a safe key
              chatMessages.map((message, index) => {
                const mine = message.userId === user?.id;
                return (
                  <div
                    key={index}
                    className={mine ? "chat chat-end" : "chat chat-start"}
                  >
                    <div className="chat-header text-xs">
                      {mine ? "You" : message.username}
                    </div>
                    <div className="chat-bubble whitespace-pre-wrap break-words text-sm">
                      {message.content}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex shrink-0 items-center gap-2 border-t border-base-300 p-3"
          >
            <input
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={canSend ? "Your message" : "You are not in a game"}
              aria-label="Your message"
              // The server refuses messages over 500 characters
              maxLength={500}
              disabled={!canSend}
              className="input input-sm w-full flex-1"
            />
            <button
              type="submit"
              className="btn btn-sm btn-secondary"
              disabled={!canSend || text === ""}
            >
              Send
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((isOpen) => !isOpen)}
        aria-label={open ? "Close game chat" : "Open game chat"}
        aria-expanded={open}
        className={
          notify
            ? "btn btn-lg btn-circle btn-warning shadow-lg"
            : "btn btn-lg btn-circle btn-secondary shadow-lg"
        }
      >
        <img src={messageIcon} alt="" aria-hidden="true" className="size-6" />
      </button>
    </div>
  );
}
