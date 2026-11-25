type AvatarSize = "sm" | "md" | "lg";

// Full class names (not built from the size) so Tailwind can find them
const SIZES: Record<AvatarSize, { box: string; letter: string }> = {
  sm: { box: "w-8", letter: "text-sm" },
  md: { box: "w-12", letter: "text-xl" },
  lg: { box: "w-24", letter: "text-4xl" },
};

// Placeholder colors: one of the four UNO colors, always the same for a name
const COLORS = [
  "bg-primary text-primary-content",
  "bg-secondary text-secondary-content",
  "bg-success text-success-content",
  "bg-accent text-accent-content",
];

function colorOf(username: string): string {
  let hash = 0;
  for (const char of username) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

interface Props {
  username: string;
  avatarUrl?: string | null;
  size?: AvatarSize;
  fullRounded?: boolean;
}

// Avatar: the picture, or the first letter of the username on a UNO color
// when the user has no picture. Round with a white edge, or a rounded square
// with fullRounded={false} (same shape with or without a picture, so it fits
// the frame drawn around it)
export function UserAvatar({
  username,
  avatarUrl,
  size = "md",
  fullRounded = true,
}: Props) {
  const { box, letter } = SIZES[size];
  // Round: white edge. Rounded square: no edge, the frame around it (header
  // menu) already outlines it
  const shape = fullRounded
    ? "rounded-full border-2 border-white"
    : "rounded-[30%]";

  if (avatarUrl) {
    return (
      <div className="avatar">
        <div className={`${shape} ${box}`}>
          <img src={avatarUrl} alt={`Avatar of ${username}`} />
        </div>
      </div>
    );
  }

  return (
    <div className="avatar avatar-placeholder">
      <div className={`${shape} ${colorOf(username)} ${box}`}>
        <span className={`font-bold ${letter}`}>
          {username.charAt(0).toUpperCase()}
        </span>
      </div>
    </div>
  );
}
