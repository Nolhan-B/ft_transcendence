import { Link } from "react-router-dom";

export function UserProfileIcon() {
  return (
    <Link
      to="/profile"
      aria-label="Profile"
      className="btn btn-ghost btn-circle avatar avatar-online"
    >
      <div className="w-10 rounded-full">
        <img src="https://img.daisyui.com/images/profile/demo/gordon@192.webp" alt="" />
      </div>
    </Link>
  );
}
