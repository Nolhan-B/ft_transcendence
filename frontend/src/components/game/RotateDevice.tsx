import { Link } from "react-router-dom";

// The game is played in landscape. On a phone held upright (narrow and
// portrait) this covers the whole screen; it disappears when the phone is
// turned. A web page cannot force the orientation, so it asks for it.
export function RotateDevice() {
  return (
    <div
      role="alert"
      className="fixed inset-0 z-50 hidden flex-col items-center justify-center gap-6 bg-base-100 p-8 text-center max-md:portrait:flex"
    >
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="h-24 w-24 animate-pulse text-accent"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
        />
      </svg>
      <div>
        <h2 className="text-2xl font-bold">Turn your phone</h2>
        <p className="mt-2 opacity-80">The game is played in landscape mode.</p>
      </div>
      <Link to="/play" className="btn btn-ghost">
        Back to the lobby
      </Link>
    </div>
  );
}
