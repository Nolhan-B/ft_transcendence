import { useEffect, useState } from "react";
import { FriendManager } from "../FriendManager/FriendManager";
import FriendChat from "../FriendManager/components/FriendChat";
import { Profile } from "shared";

// Vertical button glued to the right edge of the window, vertically centered.
// Opens a drawer sliding in from the right.
export function SideButton() {
  const [open, setOpen] = useState(false);
  const [currentOpenedFriendChat, setCurrentOpenedFriendChat] =
    useState<Profile | null>(null);

  // Escape closes the drawer
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="btn btn-secondary fixed right-0 top-1/2 z-20 h-auto -translate-y-1/2 rounded-r-none px-2 py-4 [writing-mode:vertical-rl]"
      >
        Friends
      </button>

      <div
        className={`fixed inset-0 z-30 overflow-hidden ${open ? "" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        <button
          type="button"
          aria-label="Close menu"
          tabIndex={open ? 0 : -1}
          onClick={() => {
            setOpen(false);
            setCurrentOpenedFriendChat(null);
          }}
          className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />
        {open && currentOpenedFriendChat && (
          <div className="absolute right-80 top-0 z-10 h-full rounded-l-lg bg-base-200 p-4 shadow-xl">
            <div className="flex h-full flex-col">
              <FriendChat profile={currentOpenedFriendChat}></FriendChat>
            </div>
          </div>
        )}
        <aside
          className={`absolute right-0 top-0 flex h-full w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden bg-base-200 p-4 shadow-xl transition-transform duration-200 ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <p className="mb-3 shrink-0 text-sm opacity-60">Friends</p>
          <div className="flex min-h-0 flex-1 flex-col">
            <FriendManager
              setCurrentOpenedFriendChat={setCurrentOpenedFriendChat}
              currentOpenedFriendChat={currentOpenedFriendChat}
            />
          </div>
        </aside>
      </div>
    </>
  );
}
