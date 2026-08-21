import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BellIcon, CheckIcon } from "../Icons.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useNotifications } from "../../context/NotificationContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { getNotificationPath } from "../../utils/notificationHelpers.js";

/**
 * Displays the shared unread count and recent-notification menu.
 * @param {void} _unused - This component accepts no props.
 * @returns {import("react").ReactElement} Header notification control.
 * @sideEffects Loads recent notifications and updates read state.
 */
export function NotificationBell() {
  const { user } = useAuth();
  const {
    notifications,
    unreadCount,
    isLoading,
    loadNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const rootReference = useRef(null);
  const notificationPagePath =
    user?.role === "caregiver"
      ? "/caregiver/notifications"
      : "/notifications";

  useEffect(() => {
    /**
     * Closes the dropdown after an outside pointer action.
     * @param {MouseEvent} event - Browser mouse event.
     * @returns {void}
     * @sideEffects Updates dropdown state.
     */
    function handleOutsideClick(event) {
      if (
        rootReference.current
        && !rootReference.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    /**
     * Closes the dropdown when Escape is pressed.
     * @param {KeyboardEvent} event - Browser keyboard event.
     * @returns {void}
     * @sideEffects Updates dropdown state.
     */
    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick,
      );
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  /**
   * Opens or closes the dropdown and refreshes its recent records.
   * @returns {Promise<void>}
   * @sideEffects Updates dropdown state and may request notification data.
   */
  async function toggleMenu() {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    if (nextOpen) {
      try {
        await loadNotifications({
          page: 1,
          limit: 6,
        });
      } catch {
        showToast(
          "Notifications could not be loaded.",
          "error",
        );
      }
    }
  }

  /**
   * Marks one notification read before its normal link navigation.
   * @param {object} notification - Selected notification.
   * @returns {Promise<void>}
   * @sideEffects May update notification state and closes the dropdown.
   */
  async function readNotification(notification) {
    try {
      if (!notification.isRead) {
        await markAsRead(notification._id);
      }
    } catch {
      showToast(
        "The notification could not be marked read.",
        "error",
      );
    } finally {
      setIsOpen(false);
    }
  }

  /**
   * Marks all caller-owned notifications read from the dropdown.
   * @returns {Promise<void>}
   * @sideEffects Calls the bulk API and updates shared notification state.
   */
  async function handleMarkAllRead() {
    try {
      setIsMarkingAll(true);
      await markAllAsRead();
      showToast(
        "All notifications marked as read.",
        "success",
      );
    } catch {
      showToast(
        "Notifications could not be updated.",
        "error",
      );
    } finally {
      setIsMarkingAll(false);
    }
  }

  /**
   * Closes the dropdown after opening the full notification center.
   * @returns {void}
   * @sideEffects Updates dropdown state.
   */
  function closeMenu() {
    setIsOpen(false);
  }

  return (
    <div
      className="notification-bell"
      ref={rootReference}
    >
      <button
        className="notification-bell__button"
        type="button"
        aria-label={
          `Notifications, ${unreadCount} unread`
        }
        aria-expanded={isOpen}
        aria-haspopup="true"
        onClick={toggleMenu}
      >
        <BellIcon size={19} />
        {unreadCount > 0 && (
          <span className="notification-bell__count">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <section
          className="notification-dropdown"
          aria-label="Recent notifications"
        >
          <div className="notification-dropdown__heading">
            <div>
              <strong>Notifications</strong>
              <span>{unreadCount} unread</span>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                disabled={isMarkingAll}
                onClick={handleMarkAllRead}
              >
                <CheckIcon size={15} />
                {isMarkingAll
                  ? "Updating..."
                  : "Mark all read"}
              </button>
            )}
          </div>

          <div className="notification-dropdown__list">
            {isLoading && (
              <div className="notification-dropdown__empty">
                Loading notifications...
              </div>
            )}

            {!isLoading && notifications.length === 0 && (
              <div className="notification-dropdown__empty">
                <BellIcon size={22} />
                <span>No notifications yet.</span>
              </div>
            )}

            {!isLoading && notifications.map((notification) => (
              <Link
                className={
                  notification.isRead
                    ? "notification-dropdown__item"
                    : "notification-dropdown__item notification-dropdown__item--unread"
                }
                to={getNotificationPath(
                  notification,
                  notificationPagePath,
                )}
                key={notification._id}
                onClick={() => readNotification(notification)}
              >
                <strong>{notification.title}</strong>
                <span>{notification.message}</span>
                <time>
                  {new Date(
                    notification.createdAt,
                  ).toLocaleString()}
                </time>
              </Link>
            ))}
          </div>

          <Link
            className="notification-dropdown__footer"
            to={notificationPagePath}
            onClick={closeMenu}
          >
            View all notifications
          </Link>
        </section>
      )}
    </div>
  );
}
