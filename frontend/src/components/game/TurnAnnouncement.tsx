import { useEffect, useState } from "react";

const SHOWN_MS = 1800;

interface Props {
  // The player whose turn it is: the pop-up shows again when it changes
  playerId: string | undefined;
  name: string;
  mine: boolean;
}

// A short pop-up announcing whose turn begins
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
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      <div
        role="status"
        className={`alert px-8 py-6 text-2xl font-bold shadow-2xl ${
          mine ? "alert-warning" : "alert-info"
        }`}
      >
        {mine ? "Your turn!" : `${name}'s turn`}
      </div>
    </div>
  );
}
