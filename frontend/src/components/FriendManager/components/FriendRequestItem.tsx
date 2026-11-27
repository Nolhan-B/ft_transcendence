import defaultProfilePicture from "../../../assets/images/default-profile-picture.png";

// Friend request item: a pending request waiting for an answer
export type FriendRequestItemProps = {
  name?: string | null;
  avatarUrl?: string | null;
  onAccept?: (name: string) => void;
  onDecline?: (name: string) => void;
};

export function FriendRequestItem({
  name,
  avatarUrl,
  onAccept,
  onDecline,
}: FriendRequestItemProps) {
  // `name = "missingno"` would not cover null: a default only applies to undefined
  const displayName = name ?? "missingno";

  return (
    <div className="flex w-full items-center gap-3 rounded-box border border-warning/30 bg-warning/10 p-2">
      <div className="avatar">
        <div className="w-10 rounded-full ring-2 ring-warning/40">
          <img
            alt={`${displayName} profile picture`}
            src={avatarUrl ? avatarUrl : defaultProfilePicture}
            className="object-cover"
          />
        </div>
      </div>

      <span className="min-w-0 flex-1 truncate font-medium">{displayName}</span>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          className="btn btn-success btn-sm btn-circle"
          aria-label={`Accept ${displayName}`}
          title="Accept"
          onClick={() => onAccept?.(displayName)}
        >
          <svg
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 12.5l5 5L20 6.5" />
          </svg>
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-circle text-error"
          aria-label={`Decline ${displayName}`}
          title="Decline"
          onClick={() => onDecline?.(displayName)}
        >
          <svg
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
