import messageIcon from "../../assets/icons/message.svg";
import { FriendManager } from "../FriendManager/FriendManager";
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
      <div className="tabs tabs-box w-80 max-w-[calc(100vw-2rem)] whitespace-normal">
        <input
          type="radio"
          name="my_tabs_6"
          className="tab"
          aria-label="Friends messages"
          defaultChecked
        />
        <div className="tab-content h-[26rem] max-h-[calc(100vh-8rem)] bg-base-100 border-base-300 p-6">
          <div className="flex h-full flex-col">
            <FriendManager />
          </div>
        </div>
        <input
          type="radio"
          name="my_tabs_6"
          className="tab"
          aria-label="Game chat"
        />
        <div className="tab-content h-[26rem] max-h-[calc(100vh-8rem)] bg-base-100 border-base-300 p-6">
          <div className="flex h-full flex-col">
            <GameChat />
          </div>
        </div>
      </div>
    </div>
  );
}
