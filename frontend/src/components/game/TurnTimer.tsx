interface Props {
  secondsLeft: number;
  total: number;
  // Bigger version for the player's own seat
  large?: boolean;
}

// Round countdown of a turn: turns red in the last seconds
export function TurnTimer({ secondsLeft, total, large = false }: Props) {
  const urgent = secondsLeft <= 5;

  return (
    <div
      role="timer"
      aria-label={`${secondsLeft} seconds left`}
      className={`radial-progress font-bold ${
        urgent ? "text-error" : "text-accent"
      } ${large ? "text-xl" : "text-sm"}`}
      style={
        {
          "--value": (secondsLeft / total) * 100,
          "--size": large ? "3.5rem" : "2.5rem",
          "--thickness": large ? "5px" : "4px",
        } as React.CSSProperties
      }
    >
      {secondsLeft}
    </div>
  );
}
