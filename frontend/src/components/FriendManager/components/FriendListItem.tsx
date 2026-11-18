import { ButtonHTMLAttributes } from "react";
import defaultProfilePicture from "../../../assets/images/default-profile-picture.png";

// Friend list item
export type FriendListItemProps = {
  name?: string | null;
  avatarUrl?: string | null;
  elo?: number | null;
  onRemove?: () => void;
} & ButtonHTMLAttributes<HTMLButtonElement>;

function openConfirm() {
  const doc = document.getElementById("my_modal_1") as HTMLDialogElement | null;
  doc?.showModal();
}

// The remove button cannot live inside the main button: a nested <button> is
// invalid HTML and breaks keyboard navigation. The row is a flex container
// holding two sibling buttons instead.
export function FriendListItem({
  name = "missingno",
  avatarUrl,
  elo,
  onRemove,
  className,
  ...rest
}: FriendListItemProps) {
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

        <span className="min-w-0 flex-1 truncate font-medium">{name}</span>

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
      <dialog id="my_modal_1" className="modal">
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
