import { ButtonHTMLAttributes } from "react";
import defaultProfilePicture from "../../../assets/images/default-profile-picture.png";

// Friend list item
export type FriendListItemProps = {
  name? : string | null;
  avatarUrl? : string | null;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function FriendListItem({
  name = "missingno",
  avatarUrl,
  ...rest
}: FriendListItemProps) {
  return (
    <button className="btn justify-start border-0 flex flex-1 bg-neutral p-2 rounded-xl flex gap-5 text-base">
        <img
            alt="Friend profile picture"
            src={avatarUrl ? avatarUrl : defaultProfilePicture}
            className="size-10 shrink-0 rounded-full object-cover"
        />
        {name}
    </button>
  );
}
