import { useRef } from "react";
import type { Profile } from "shared";
import { useBlocks } from "../../hooks/user/useBlocks";

// Block / unblock button of another user's profile. Blocking asks first:
// it also ends the friendship. Only for a connected user (it needs the chat).
export function BlockUserButton({ profile }: { profile: Profile }) {
  const { loading, busy, error, isBlocked, block, unblock } = useBlocks();
  const dialog = useRef<HTMLDialogElement>(null);
  const blocked = isBlocked(profile.id);

  if (loading) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      {blocked ? (
        <button
          type="button"
          className="btn btn-sm btn-outline"
          disabled={busy}
          onClick={() => unblock(profile.id)}
        >
          Unblock
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-sm btn-ghost text-error"
          disabled={busy}
          onClick={() => dialog.current?.showModal()}
        >
          <svg
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M5.6 5.6l12.8 12.8" />
          </svg>
          Block
        </button>
      )}
      {blocked && <span className="text-xs opacity-60">You blocked them</span>}
      {error && (
        <span role="alert" className="text-xs text-error">
          {error}
        </span>
      )}

      <dialog ref={dialog} className="modal">
        <div className="modal-box">
          <h3 className="text-lg font-bold">Block {profile.username}?</h3>
          <p className="py-4 text-sm opacity-80">
            You will no longer be friends. Neither of you will be able to send
            messages or friend requests to the other. You can unblock them later
            from this page or from your settings.
          </p>
          <form method="dialog" className="modal-action">
            <button className="btn btn-ghost">Cancel</button>
            <button
              className="btn btn-error"
              onClick={() => void block(profile)}
            >
              Block
            </button>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button aria-label="Close">close</button>
        </form>
      </dialog>
    </div>
  );
}
