import type { ReactNode } from "react";

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

// A modal opened by the parent (open prop): used to ask a color or a target
export function ChoiceDialog({ open, title, onClose, children }: Props) {
  return (
    <dialog className={`modal ${open ? "modal-open" : ""}`}>
      <div className="modal-box animate-pop">
        <h3 className="text-display text-center text-2xl">{title}</h3>
        <div className="mt-5 flex flex-col items-center gap-3">{children}</div>
        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  );
}
