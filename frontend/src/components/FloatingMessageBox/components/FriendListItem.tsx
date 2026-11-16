import { ButtonHTMLAttributes } from "react";
import defaultProfilePicture from "../../../assets/images/default-profile-picture.png";

// Friend list item
export type FriendListItemProps = {
  name?: string | null;
  avatarUrl?: string | null;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function FriendListItem({
  name = "missingno",
  avatarUrl,
  ...rest
}: FriendListItemProps) {
  // h-auto: .btn has a fixed height (2.5rem), which is exactly the avatar size,
  // so p-2 would make the image overflow the button. Let the padding drive the
  // height instead.
  return (
    <button
      {...rest}
      className="btn h-auto w-full justify-start border-0 flex bg-neutral p-1 rounded-xl gap-5 text-base"
    >
      <img
        alt="Friend profile picture"
        src={avatarUrl ? avatarUrl : defaultProfilePicture}
        className="size-10 shrink-0 rounded-full object-cover"
      />
      {name}
    </button>
  );
}
