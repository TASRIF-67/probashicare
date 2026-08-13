import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BellIcon } from "../Icons.jsx";
import { notificationService } from "../../services/notificationService.js";

/**
 * Displays unread subscription notifications and a recent-notification menu.
 * @returns {import("react").ReactElement} Header notification control.
 * @sideEffects Polls notification API, marks items read, and manages document clicks.
 */
export function NotificationBell() {
  const [state, setState] = useState({
    open: false,
    notifications: [],
    unreadCount: 0,
    loading: false,
  });
  const rootReference = useRef(null);

  /**
   * Loads recent notifications and unread count.
   * @param {boolean} [showLoading=false] - Whether to display menu loading.
   * @returns {Promise<void>}
   * @sideEffects Calls notification API and updates state.
   */
  async function loadNotifications(showLoading = false) {
    if (showLoading) {
      setState((current) => ({ ...current, loading: true }));
    }

    try {
      const data = await notificationService.list({ limit: 6 });
      setState((current) => ({
        ...current,
        notifications: data.notifications,
        unreadCount: data.unreadCount,
        loading: false,
      }));
    } catch {
      setState((current) => ({ ...current, loading: false }));
    }
  }

  useEffect(() => {
    loadNotifications();
    const intervalId = window.setInterval(() => {
      loadNotifications();
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    /** Closes the menu after an outside pointer action. @param {MouseEvent} event - Document event. @returns {void} @sideEffects Updates state. */
    function handleOutsideClick(event) {
      if (!rootReference.current?.contains(event.target)) {
        setState((current) => ({ ...current, open: false }));
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  /** Toggles the dropdown and refreshes content. @returns {void} @sideEffects Updates state and may call API. */
  function toggleMenu() {
    const nextOpen = !state.open;
    setState((current) => ({ ...current, open: nextOpen }));

    if (nextOpen) {
      loadNotifications(true);
    }
  }

  /**
   * Marks one item read before normal link navigation.
   * @param {object} notification - Selected notification.
   * @returns {Promise<void>}
   * @sideEffects Calls API and updates unread state.
   */
  async function readNotification(notification) {
    if (!notification.isRead) {
      await notificationService.markRead(notification._id);
      await loadNotifications();
    }
    setState((current) => ({ ...current, open: false }));
  }

  return (
    <div className="notification-bell" ref={rootReference}>
      <button
        className="notification-bell__button"
        type="button"
        aria-label={"Notifications, " + state.unreadCount + " unread"}
        aria-expanded={state.open}
        onClick={toggleMenu}
      >
        <BellIcon size={19} />
        {state.unreadCount > 0 && (
          <span className="notification-bell__count">
            {state.unreadCount > 99 ? "99+" : state.unreadCount}
          </span>
        )}
      </button>
      {state.open && (
        <div className="notification-dropdown">
          <div className="notification-dropdown__heading">
            <strong>Notifications</strong>
            <span>{state.unreadCount} unread</span>
          </div>
          {state.loading && <div className="notification-dropdown__empty">Loading notifications</div>}
          {!state.loading && !state.notifications.length && <div className="notification-dropdown__empty">No notifications yet.</div>}
          {!state.loading && state.notifications.map((notification) => (
            <Link
              className={"notification-dropdown__item " + (!notification.isRead ? "notification-dropdown__item--unread" : "")}
              to={notification.actionUrl || "/notifications"}
              key={notification._id}
              onClick={() => readNotification(notification)}
            >
              <strong>{notification.title}</strong>
              <span>{notification.message}</span>
              <time>{new Date(notification.createdAt).toLocaleString()}</time>
            </Link>
          ))}
          <Link className="notification-dropdown__footer" to="/notifications" onClick={() => setState((current) => ({ ...current, open: false }))}>View all notifications</Link>
        </div>
      )}
    </div>
  );
}
