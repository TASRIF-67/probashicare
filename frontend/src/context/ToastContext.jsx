import { createContext, useContext, useMemo, useState } from "react";

const ToastContext = createContext(null);

/**
 * Provides short-lived application notifications.
 * @param {{children: import("react").ReactNode}} props - Descendant application tree.
 * @returns {import("react").ReactElement} Toast context and viewport.
 * @sideEffects Creates and clears timers when notifications are shown.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  /**
   * Displays a toast for four seconds.
   * @param {string} message - Notification text.
   * @param {"success"|"error"|"info"} [tone="info"] - Visual and semantic tone.
   * @returns {void}
   * @sideEffects Updates React state and schedules a timer.
   */
  function showToast(message, tone = "info") {
    const id = globalThis.crypto.randomUUID();
    setToasts((items) => [...items, { id, message, tone }]);
    setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 4000);
  }

  const value = useMemo(() => ({ showToast }), []);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite">
        {toasts.map((toast) => (
          <div className={`toast toast--${toast.tone}`} key={toast.id}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Reads the notification action from ToastProvider.
 * @param {void} _unused - This hook accepts no arguments.
 * @returns {{showToast: (message: string, tone?: string) => void}} Toast action.
 * @sideEffects None.
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider.");
  return context;
}
