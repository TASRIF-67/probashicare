import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useNotifications } from "../../context/NotificationContext.jsx";
import { BellIcon } from "../Icons.jsx";

/**
 * Formats a notification timestamp for compact display.
 * @param {string|Date} value - Stored creation time.
 * @returns {string} Localized date and time.
 * @sideEffects None.
 */
function formatNotificationTime(value) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return formatter.format(new Date(value));
}

/**
 * Displays the authenticated user's unread badge and recent notifications.
 * @returns {import("react").ReactElement} Notification bell and dropdown.
 * @sideEffects Loads and updates notifications and may navigate to an action.
 */
export function NotificationBell() {
  const { user } = useAuth();
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    loadNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const containerReference = useRef(null);
  const navigate = useNavigate();

  const historyPath =
    user.role === "caregiver"
      ? "/caregiver/notifications"
      : "/notifications";
  const displayedCount = unreadCount > 99 ? "99+" : unreadCount;

  useEffect(() => {
    /**
     * Closes the dropdown when focus is clicked elsewhere.
     * @param {MouseEvent} event - Document click event.
     * @returns {void}
     * @sideEffects Updates dropdown state.
     */
    function handleDocumentClick(event) {
      const container = containerReference.current;

      if (container && !container.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleDocumentClick);

    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, []);

  /**
   * Opens or closes the dropdown and loads its recent records.
   * @returns {Promise<void>}
   * @sideEffects Updates dropdown state and may call the notification API.
   */
  async function toggleDropdown() {
    const nextIsOpen = !isOpen;
    setIsOpen(nextIsOpen);

    if (nextIsOpen) {
      try {
        await loadNotifications({
          limit: 8,
        });
      } catch {
        // The context exposes a readable error inside the dropdown.
      }
    }
  }

  /**
   * Marks one notification read and opens its internal action.
   * @param {object} notification - Selected notification.
   * @returns {Promise<void>}
   * @sideEffects Updates the notification and changes the application route.
   */
  async function openNotification(notification) {
    if (!notification.readAt) {
      await markAsRead(notification._id);
    }

    setIsOpen(false);

    if (notification.actionPath) {
      navigate(notification.actionPath);
    }
  }

  /**
   * Marks every notification read without closing the dropdown.
   * @returns {Promise<void>}
   * @sideEffects Calls the bulk notification update.
   */
  async function handleMarkAllAsRead() {
    await markAllAsRead();
  }

  return (
    <div className="notification-bell" ref={containerReference}>
      <button
        className="notification-bell__button"
        type="button"
        aria-label={"Notifications, " + unreadCount + " unread"}
        aria-expanded={isOpen}
        onClick={toggleDropdown}
      >
        <BellIcon size={20} />
        {unreadCount > 0 && (
          <span className="notification-bell__count">
            {displayedCount}
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
            <button
              type="button"
              disabled={!unreadCount}
              onClick={handleMarkAllAsRead}
            >
              Mark all read
            </button>
          </div>

          {isLoading && (
            <div className="notification-dropdown__message">
              <span className="spinner" />
              Loading notifications
            </div>
          )}

          {error && (
            <div className="notification-dropdown__message">
              {error}
            </div>
          )}

          {!isLoading && !error && !notifications.length && (
            <div className="notification-dropdown__message">
              No notifications yet.
            </div>
          )}

          <div className="notification-dropdown__list">
            {notifications.map((notification) => (
              <button
                className={
                  notification.readAt
                    ? "notification-item"
                    : "notification-item notification-item--unread"
                }
                type="button"
                onClick={() => {
                  openNotification(notification);
                }}
                key={notification._id}
              >
                <span
                  className={
                    "notification-item__indicator notification-item__indicator--" +
                    notification.priority
                  }
                  aria-hidden="true"
                />
                <span>
                  <strong>{notification.title}</strong>
                  <small>{notification.message}</small>
                  <time dateTime={notification.createdAt}>
                    {formatNotificationTime(notification.createdAt)}
                  </time>
                </span>
              </button>
            ))}
          </div>

          <Link
            className="notification-dropdown__footer"
            to={historyPath}
            onClick={() => {
              setIsOpen(false);
            }}
          >
            View all notifications
          </Link>
        </section>
      )}
    </div>
  );
}
