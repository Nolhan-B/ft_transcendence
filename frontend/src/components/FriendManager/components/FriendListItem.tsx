import { ButtonHTMLAttributes } from "react";
import defaultProfilePicture from "../../../assets/images/default-profile-picture.png";

// Friend list item
export type FriendListItemProps = {
  name?: string | null;
  avatarUrl?: string | null;
  onRemove?: () => void;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function FriendListItem({
  name = "missingno",
  avatarUrl,
  onRemove,
  ...rest
}: FriendListItemProps) {
  // h-auto: .btn has a fixed height (2.5rem), which is exactly the avatar size,
  // so p-2 would make the image overflow the button. Let the padding drive the
  // height instead.
  return (
    <button
      {...rest}
      className="btn h-auto w-full justify-between border-0 flex bg-neutral p-1 rounded-xl gap-5 text-base"
    >
      <div className="flex items-center gap-4">
        <img
          alt="Friend profile picture"
          src={avatarUrl ? avatarUrl : defaultProfilePicture}
          className="size-10 shrink-0 rounded-full object-cover"
        />
        {name}
      </div>
      <button
        className="btn btn-sm btn-circle btn-ghost btn-error"
        aria-label={`Decline`}
        title="Decline"
        onClick={onRemove}
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
    </button>
  );
}
