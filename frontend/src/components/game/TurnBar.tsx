import type { Player } from "shared";
import { UserAvatar } from "../user/UserAvatar";
import { TurnTimer } from "./TurnTimer";

interface Props {
  turnPlayer: Player | undefined;
  myTurn: boolean;
  // Seconds left in the turn (null: no timer, e.g. a bot)
  secondsLeft: number | null;
  turnSeconds: number;
  direction: 1 | -1;
}

// Whose turn it is, in one line between the table and my hand: the player
// (or "Your turn!"), the countdown and the direction of play
export function TurnBar({
  turnPlayer,
  myTurn,
  secondsLeft,
  turnSeconds,
  direction,
}: Props) {
  const bot = turnPlayer?.userId.startsWith("bot_") ?? false;

  return (
    <div className="flex justify-center">
      <div
        role="status"
        className={`panel-glass flex items-center gap-3 rounded-full border py-1 pr-2 pl-1.5 compact:gap-2 tiny:py-0.5 ${
          myTurn ? "animate-turn" : ""
        }`}
      >
        {myTurn ? (
          <span className="text-display px-2 text-xl text-accent compact:text-lg tiny:text-sm">
            Your turn!
          </span>
        ) : (
          turnPlayer && (
            <span className="flex min-w-0 items-center gap-2 font-semibold compact:text-sm tiny:text-xs">
              <span className="tiny:hidden">
                <UserAvatar username={turnPlayer.username} size="sm" />
              </span>
              <span className="max-w-40 truncate">{turnPlayer.username}</span>
              <span className="font-normal text-white/60">
                {bot ? "is thinking" : "is playing"}
              </span>
            </span>
          )
        )}

        <span className="flex size-10 shrink-0 items-center justify-center">
          {secondsLeft !== null && (
            <TurnTimer secondsLeft={secondsLeft} total={turnSeconds} />
          )}
          {bot && (
            <span
              className="loading loading-dots loading-md text-accent"
              aria-label="The bot is playing"
            />
          )}
        </span>

        <span
          className="rounded-full bg-black/30 px-2.5 py-1 text-xs font-semibold text-white/70 tiny:hidden"
          title="Direction of play"
        >
          {direction === 1 ? "↻ Clockwise" : "↺ Counter-clockwise"}
        </span>
      </div>
    </div>
  );
}
