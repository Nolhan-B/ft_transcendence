type AvatarSize = "sm" | "md" | "lg";

// Full class names (not built from the size) so Tailwind can find them
const SIZES: Record<AvatarSize, { box: string; letter: string }> = {
  sm: { box: "w-8", letter: "text-sm" },
  md: { box: "w-12", letter: "text-xl" },
  lg: { box: "w-24", letter: "text-4xl" },
};

interface Props {
  username: string;
  avatarUrl?: string | null;
  size?: AvatarSize;
}

// Squircle avatar: the picture, or the first letter of the username when the
// user has no picture
export function UserAvatar({ username, avatarUrl, size = "md" }: Props) {
  const { box, letter } = SIZES[size];

  if (avatarUrl) {
    return (
      <div className="avatar">
        <div className={`mask mask-squircle ${box}`}>
          <img src={avatarUrl} alt={`Avatar of ${username}`} />
        </div>
      </div>
    );
  }

  return (
    <div className="avatar avatar-placeholder">
      <div
        className={`mask mask-squircle bg-neutral text-neutral-content ${box}`}
      >
        <span className={letter}>{username.charAt(0).toUpperCase()}</span>
      </div>
    </div>
  );
}
