import { useEffect, useState } from "react";
import type { Player } from "shared";
import type { UnoEvent } from "../../context/GameContext";

const SHOWN_MS = 2500;

interface Props {
  event: UnoEvent | null;
  players: Player[];
  myId: string;
}

// A short pop-up when a player says UNO or is caught without saying it.
// Top-right corner of the board (the turn pop-up uses the top-left one).
export function UnoAnnouncement({ event, players, myId }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!event) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), SHOWN_MS);
    return () => clearTimeout(timer);
  }, [event]);

  if (!visible || !event) return null;

  const name = (id: string | undefined) =>
    id === myId
      ? "You"
      : (players.find((player) => player.userId === id)?.username ?? "?");

  let text: string;
  if (event.kind === "called")
    text =
      event.userId === myId ? "You said UNO!" : `${name(event.userId)}: UNO!`;
  else if (event.userId === myId)
    text = `${name(event.byUserId)} caught you! +2 cards`;
  else text = `${name(event.byUserId)} caught ${name(event.userId)}! +2 cards`;

  return (
    <div className="pointer-events-none absolute right-4 top-4 z-30 compact:right-2 compact:top-2">
      <div
        role="status"
        className={`alert px-6 py-4 text-2xl font-bold shadow-2xl compact:px-4 compact:py-2 compact:text-lg tiny:px-2 tiny:py-1 tiny:text-sm ${
          event.kind === "called" ? "alert-warning" : "alert-error"
        }`}
      >
        {text}
      </div>
    </div>
  );
}
