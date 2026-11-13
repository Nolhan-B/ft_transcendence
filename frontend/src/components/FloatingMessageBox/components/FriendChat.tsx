import { useState } from "react";
import { FriendListItem } from "./FriendListItem";
import { OpenedFriendChat } from "./OpenedFriendChat";




export function FriendChat() {
  const [openedFriendConv, setOpenedFriendConv] = useState("");

  async function switchOpenedFriendConv(e: React.FormEvent) {
    e.preventDefault(); // Anti browser reloading
    console.log("WIP, switching to " + openedFriendConv);
  }

  return (
    <div className="flex flex-1 flex-col gap-1">
      {/* <FriendListItem />
      <FriendListItem />
      <FriendListItem /> */}
      <OpenedFriendChat />
    </div>
  );
}
