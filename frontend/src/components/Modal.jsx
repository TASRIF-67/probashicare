import { useEffect } from "react";
import { CloseIcon } from "./Icons.jsx";

/**
 * Displays accessible focused information over the current view.
 * @param {{isOpen: boolean, title: string, children: import("react").ReactNode, onClose: () => void}} props - Modal state, content, and close action.
 * @returns {import("react").ReactElement|null} Dialog overlay when open.
 * @sideEffects Registers an Escape-key listener while visible.
 */
export function Modal({ isOpen, title, children, onClose }) {
  useEffect(() => {
    /**
     * Closes the dialog when Escape is pressed.
     * @param {KeyboardEvent} event - Browser keyboard event.
     * @returns {void}
     * @sideEffects Calls `onClose` for Escape.
     */
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    if (isOpen) document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-button" type="button" aria-label="Close dialog" title="Close" onClick={onClose}>
            <CloseIcon size={19} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
