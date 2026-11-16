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
      <div className="modal-box">
        <h3 className="text-lg font-bold">{title}</h3>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {children}
        </div>
        <div className="modal-action">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  );
}
