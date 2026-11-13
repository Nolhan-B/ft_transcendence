import messageIcon from "../../assets/icons/message.svg";
import { FriendChat } from "./components/FriendChat";
import { GameChat } from "./components/GameChat";

export function FloatingMessageBox() {
  return (
    <div className="fab">
      <div
        tabIndex={0}
        role="button"
        aria-label="New message"
        className="btn btn-lg btn-circle btn-secondary"
      >
        <img src={messageIcon} alt="" aria-hidden="true" className="size-6" />
      </div>
      <div className="tabs tabs-box">
        <input
          type="radio"
          name="my_tabs_6"
          className="tab"
          aria-label="Friends messages"
          defaultChecked
        />
        <div className="tab-content bg-base-100 border-base-300 p-6">
          <FriendChat />
        </div>
        <input
          type="radio"
          name="my_tabs_6"
          className="tab"
          aria-label="Game chat"
        />
        <div className="tab-content bg-base-100 border-base-300 p-6">
          <GameChat />
        </div>
      </div>
    </div>
  );
}
