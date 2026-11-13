import defaultProfilePicture from "../../../assets/images/default-profile-picture.png";

export function FriendChat() {
  return (
    <div>
      <div className="bg-neutral p-2 rounded-xl flex gap-5 items-center text-base">
        <img
          alt="Tailwind CSS chat bubble component"
          src={defaultProfilePicture}
          className="size-10 shrink-0 rounded-full object-cover"
        />
        User 1
      </div>
    </div>
  );
}
