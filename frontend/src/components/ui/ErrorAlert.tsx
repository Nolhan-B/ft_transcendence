interface Props {
  message: string;
  // Shows a close button when given (toasts)
  onClose?: () => void;
}

// The red alert used by every form
export function ErrorAlert({ message, onClose }: Props) {
  return (
    <div role="alert" className="alert alert-error">
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6 shrink-0 stroke-current"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>{message}</span>
      {onClose && (
        <button
          type="button"
          className="btn btn-ghost btn-circle btn-xs"
          aria-label="Dismiss"
          onClick={onClose}
        >
          ✕
        </button>
      )}
    </div>
  );
}
