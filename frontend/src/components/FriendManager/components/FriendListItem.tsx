import { ButtonHTMLAttributes, useRef } from "react";
import defaultProfilePicture from "../../../assets/images/default-profile-picture.png";
import { useChat } from "../../../hooks/ws/useChat";
import { Profile } from "shared";

// Friend list item
export type FriendListItemProps = {
  name?: string | null;
  avatarUrl?: string | null;
  elo?: number | null;
  onRemove?: () => void;
  uid?: string | null;
  currentOpenedChat: Profile | null;
} & ButtonHTMLAttributes<HTMLButtonElement>;

// The remove button cannot live inside the main button: a nested <button> is
// invalid HTML and breaks keyboard navigation. The row is a flex container
// holding two sibling buttons instead.
export function FriendListItem({
  name = "missingno",
  avatarUrl,
  elo,
  onRemove,
  className,
  uid,
  currentOpenedChat,
  ...rest
}: FriendListItemProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const { unreadSenders } = useChat();

  function openConfirm() {
    dialogRef.current?.showModal();
  }

  return (
    <div className="flex items-center gap-1 rounded-box border border-base-content/10 bg-base-200 pr-1 transition-colors hover:border-base-content/25">
      <button
        {...rest}
        className={`flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-box p-2 text-left transition-colors hover:bg-base-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary active:bg-base-300 ${className ?? ""}`}
      >
        <div className="avatar">
          <div className="w-10 rounded-full ring-2 ring-base-content/10">
            <img
              alt={`${name ?? "Friend"} profile picture`}
              src={avatarUrl ? avatarUrl : defaultProfilePicture}
              className="object-cover"
            />
          </div>
        </div>

        <span className="min-w-0 flex-1 truncate font-medium gap-2 flex items-center">
          {name}
          {uid &&
          unreadSenders.includes(uid) &&
          currentOpenedChat?.id != uid ? (
            <div aria-label="warning" className="status status-warning"></div>
          ) : (
            ""
          )}
        </span>

        {typeof elo === "number" && (
          <span className="badge badge-sm badge-ghost shrink-0 font-mono">
            {elo}
          </span>
        )}
      </button>

      <button
        type="button"
        className="btn btn-ghost btn-sm btn-circle text-error opacity-60 transition-opacity hover:opacity-100"
        aria-label={`Remove ${name ?? "friend"}`}
        title="Remove friend"
        // onClick={() => onRemove}
        onClick={openConfirm}
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
      <dialog ref={dialogRef} id="my_modal_1" className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg">Remove {name} ?</h3>
          <p className="py-4">Are you sure about that ?</p>
          <div className="modal-action">
            <form method="dialog">
              {/* if there is a button in form, it will close the modal */}
              <div className="flex gap-3">
                <button className="btn btn-error" onClick={onRemove}>
                  Remove
                </button>
                <button className="btn">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </dialog>
    </div>
  );
}
