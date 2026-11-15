import { Link } from "react-router-dom";
import defaultProfilePicture from "../../../assets/images/default-profile-picture.png";

export function UserProfileIcon() {
  return (
    <Link
      to="/profile"
      aria-label="Profile"
      className="btn btn-ghost btn-circle avatar avatar-online"
    >
      <div className="w-10 rounded-full">
        <img src={defaultProfilePicture} alt="" className="object-cover" />
      </div>
    </Link>
  );
}
