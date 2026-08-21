import { useEffect, useId, useRef } from "react";
import { CloseIcon } from "./Icons.jsx";

const FOCUSABLE_ELEMENT_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Displays accessible focused information over the current view.
 * @param {{isOpen: boolean, title: string, className?: string, children: import("react").ReactNode, onClose: () => void}} props - Modal state, optional style class, content, and close action.
 * @returns {import("react").ReactElement|null} Dialog overlay when open.
 * @sideEffects Registers an Escape-key listener while visible.
 */
export function Modal({ isOpen, title, className = "", children, onClose }) {
  const dialogRef = useRef(null);
  const previouslyFocusedElementRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    previouslyFocusedElementRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const dialog = dialogRef.current;
    const focusableElements = dialog
      ? dialog.querySelectorAll(FOCUSABLE_ELEMENT_SELECTOR)
      : [];

    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    } else if (dialog) {
      dialog.focus();
    }

    /**
     * Closes the dialog with Escape and keeps Tab focus inside it.
     * @param {KeyboardEvent} event - Browser keyboard event.
     * @returns {void}
     * @sideEffects Calls `onClose` or moves keyboard focus.
     */
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const currentFocusableElements = dialogRef.current.querySelectorAll(
        FOCUSABLE_ELEMENT_SELECTOR,
      );

      if (currentFocusableElements.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const firstElement = currentFocusableElements[0];
      const lastElement = currentFocusableElements[
        currentFocusableElements.length - 1
      ];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return function restorePageAfterDialog() {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;

      if (previouslyFocusedElementRef.current) {
        previouslyFocusedElementRef.current.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  /**
   * Closes the dialog only when the backdrop itself is selected.
   * @param {import("react").MouseEvent<HTMLDivElement>} event - Backdrop click.
   * @returns {void}
   * @sideEffects Calls the supplied close handler.
   */
  function handleBackdropMouseDown(event) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={handleBackdropMouseDown}
    >
      <section
        ref={dialogRef}
        className={("modal " + className).trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal__header">
          <h2 id={titleId}>{title}</h2>
          <button
            className="icon-button"
            type="button"
            aria-label="Close dialog"
            title="Close"
            onClick={onClose}
          >
            <CloseIcon size={19} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
