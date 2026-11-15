// import { useState } from "react";
import { OpenedFriendChat } from "./OpenedFriendChat";

export function FriendChat() {
  // const [openedFriendConv, setOpenedFriendConv] = useState("");

  // async function switchOpenedFriendConv(e: React.FormEvent) {
  //   e.preventDefault(); // Anti browser reloading
  //   console.log("WIP, switching to " + openedFriendConv);
  // }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      <OpenedFriendChat />
    </div>
  );
}
