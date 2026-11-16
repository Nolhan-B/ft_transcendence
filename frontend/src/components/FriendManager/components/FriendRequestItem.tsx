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
    <div className="flex w-full items-center gap-3 rounded-xl bg-neutral p-1">
      <img
        alt="Friend profile picture"
        src={avatarUrl ? avatarUrl : defaultProfilePicture}
        className="size-10 shrink-0 rounded-full object-cover"
      />

      <span className="min-w-0 flex-1 truncate">{displayName}</span>

      <button
        className="btn btn-sm btn-circle btn-success"
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
        className="btn btn-sm btn-circle btn-ghost btn-error"
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
  );
}
