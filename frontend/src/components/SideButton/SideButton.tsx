import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FriendManager } from "../FriendManager/FriendManager";
import FriendChat from "../FriendManager/components/FriendChat";
import { Profile } from "shared";
import { useIsMobile } from "../../hooks/useMediaQuery";
import { useChat } from "../../hooks/ws/useChat";

// Vertical button glued to the right edge of the window, vertically centered.
// Opens a drawer sliding in from the right.
export function SideButton() {
  const [open, setOpen] = useState(false);
  const [currentOpenedFriendChat, setCurrentOpenedFriendChat] =
    useState<Profile | null>(null);
  const isMobile = useIsMobile();
  const chatReplacesDrawer = isMobile && currentOpenedFriendChat !== null;
  const { friendRequests, unreadSenders } = useChat();
  const notificationCount = friendRequests.length + unreadSenders.length;
  // Read by screen readers instead of the badge
  const notificationLabel = [
    "Friends",
    friendRequests.length > 0 &&
      `${friendRequests.length} friend ${friendRequests.length === 1 ? "request" : "requests"}`,
    unreadSenders.length > 0 &&
      `unread messages from ${unreadSenders.length} ${unreadSenders.length === 1 ? "friend" : "friends"}`,
  ]
    .filter(Boolean)
    .join(", ");

  function closeMenu() {
    setOpen(false);
    setCurrentOpenedFriendChat(null);
  }

  // Going to another page (a friend's profile...) closes the drawer and the
  // chat. Done while rendering, not in an effect: no frame with the drawer
  // still open over the new page
  const { pathname } = useLocation();
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
    setCurrentOpenedFriendChat(null);
  }

  // The page under the drawer must not scroll while it is open (the wheel
  // over the title, the input or a short chat would scroll it)
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [open]);

  // Escape closes the chat first, then the drawer
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (currentOpenedFriendChat) setCurrentOpenedFriendChat(null);
      else setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, currentOpenedFriendChat]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={notificationLabel}
        aria-expanded={open}
        className="btn btn-secondary font-cyber fixed right-0 top-1/2 z-20 h-auto -translate-y-1/2 overflow-visible rounded-r-none px-2 py-4 text-xs font-bold uppercase tracking-wider [writing-mode:vertical-rl]"
      >
        Friends
        {/* Number of things waiting: friend requests + friends with unread
            messages. The key replays the pop each time the number grows */}
        {notificationCount > 0 && (
          <span
            key={notificationCount}
            aria-hidden="true"
            className="animate-pop absolute -top-2 -left-2 grid h-5 min-w-5 place-items-center rounded-full border-2 border-base-100 bg-primary px-1 font-sans text-[0.7rem] leading-none text-primary-content shadow-[0_0_10px_var(--color-primary)] [writing-mode:horizontal-tb]"
          >
            {notificationCount > 9 ? "9+" : notificationCount}
          </span>
        )}
      </button>

      <div
        className={`fixed inset-0 z-30 overflow-hidden ${open ? "" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        <button
          type="button"
          aria-label="Close menu"
          tabIndex={open ? 0 : -1}
          onClick={closeMenu}
          className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />
        {open && currentOpenedFriendChat && (
          <div
            className={
              chatReplacesDrawer
                ? // Mobile: the chat takes the drawer's place, full height.
                  "absolute right-0 top-0 z-10 flex h-full w-full flex-col bg-base-200 p-4 shadow-xl"
                : // Desktop: the chat opens to the left of the drawer.
                  "absolute right-80 top-0 z-10 h-full rounded-l-lg bg-base-200 p-4 shadow-xl"
            }
          >
            <div className="flex h-full min-h-0 flex-col">
              {chatReplacesDrawer && (
                <button
                  type="button"
                  onClick={() => setCurrentOpenedFriendChat(null)}
                  className="btn btn-ghost font-cyber btn-sm mb-2 self-start text-xs font-bold uppercase tracking-wider"
                >
                  ← Friends
                </button>
              )}
              <FriendChat profile={currentOpenedFriendChat}></FriendChat>
            </div>
          </div>
        )}
        <aside
          className={`absolute right-0 top-0 flex h-full w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden bg-base-200 p-4 shadow-xl transition-transform duration-200 ${
            open ? "translate-x-0" : "translate-x-full"
          } ${chatReplacesDrawer ? "invisible" : ""}`}
        >
          <p className="font-cyber mb-3 shrink-0 text-xs font-bold uppercase tracking-wider opacity-70">
            Friends
          </p>
          <div className="flex min-h-0 flex-1 flex-col">
            <FriendManager
              setCurrentOpenedFriendChat={setCurrentOpenedFriendChat}
              currentOpenedFriendChat={currentOpenedFriendChat}
            />
          </div>
          {/* Blocked users leave the friends list: this is the way back to
              them (to unblock). Closes the drawer itself: already on the
              settings page, the page does not change */}
          <Link
            to="/settings#blocked-users"
            onClick={closeMenu}
            tabIndex={open ? 0 : -1}
            className="mt-3 flex shrink-0 items-center gap-2 self-start rounded-box px-2 py-1 text-xs font-semibold opacity-60 transition-opacity hover:opacity-100"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M5.6 5.6l12.8 12.8" />
            </svg>
            Blocked users
          </Link>
        </aside>
      </div>
    </>
  );
}
