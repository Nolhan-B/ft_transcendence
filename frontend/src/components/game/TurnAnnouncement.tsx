import { useEffect, useState } from "react";

const SHOWN_MS = 1800;

interface Props {
  // The player whose turn it is: the pop-up shows again when it changes
  playerId: string | undefined;
  name: string;
  mine: boolean;
}

// A short pop-up announcing whose turn begins, in a corner of the board
// (the board must be positioned)
export function TurnAnnouncement({ playerId, name, mine }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!playerId) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), SHOWN_MS);
    return () => clearTimeout(timer);
  }, [playerId]);

  if (!visible) return null;

  return (
    // Top-left corner of the board: always free of seats, so the pop-up hides
    // neither the table nor a player
    <div className="pointer-events-none absolute left-4 top-4 z-30 compact:left-2 compact:top-2">
      <div
        role="status"
        className={`alert px-6 py-4 text-2xl font-bold shadow-2xl compact:px-4 compact:py-2 compact:text-lg tiny:px-2 tiny:py-1 tiny:text-sm ${
          mine ? "alert-warning" : "alert-info"
        }`}
      >
        {mine ? "Your turn!" : `${name}'s turn`}
      </div>
    </div>
  );
}
