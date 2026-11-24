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
        className={`animate-pop text-display -rotate-3 rounded-full border-4 border-white px-8 py-3 text-2xl shadow-2xl compact:px-5 compact:py-1.5 compact:text-lg tiny:border-2 tiny:px-3 tiny:py-1 tiny:text-sm ${
          event.kind === "called"
            ? "bg-primary text-white"
            : "bg-neutral text-white"
        }`}
      >
        {text}
      </div>
    </div>
  );
}
