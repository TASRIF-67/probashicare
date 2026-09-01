import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BellIcon, CheckIcon } from "../Icons.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useNotifications } from "../../context/NotificationContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { getNotificationPath } from "../../utils/notificationHelpers.js";

/**
 * Chooses the full notification page for the signed-in role.
 * @param {object|null|undefined} user - Authenticated user record.
 * @returns {string} Internal notification-center path.
 * @sideEffects None.
 */
function getNotificationPagePath(user) {
  if (user?.role === "caregiver") {
    return "/caregiver/notifications";
  }

  return "/notifications";
}

/**
 * Creates the CSS class for a read or unread dropdown item.
 * @param {object} notification - Notification API record.
 * @returns {string} Dropdown item class name.
 * @sideEffects None.
 */
function getItemClassName(notification) {
  if (notification.isRead) {
    return "notification-dropdown__item";
  }

  return [
    "notification-dropdown__item",
    "notification-dropdown__item--unread",
  ].join(" ");
}

/**
 * Limits a large unread count so it fits inside the bell badge.
 * @param {number} unreadCount - Current unread count.
 * @returns {string|number} Exact count up to 99, otherwise "99+".
 * @sideEffects None.
 */
function formatUnreadCount(unreadCount) {
  if (unreadCount > 99) {
    return "99+";
  }

  return unreadCount;
}

/**
 * Formats a notification timestamp in the browser's current locale.
 * @param {string|Date} value - Stored notification timestamp.
 * @returns {string} Readable local date and time.
 * @sideEffects None.
 */
function formatNotificationTime(value) {
  const date = new Date(value);

  // `toLocaleString` uses the user's browser language and time zone.
  return date.toLocaleString();
}

/**
 * Displays the shared unread count and recent-notification menu.
 * @param {void} _unused - This component accepts no props.
 * @returns {import("react").ReactElement} Header notification control.
 * @sideEffects Loads recent notifications and updates their read state.
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

  // Local state controls only this dropdown. Shared records and counts remain
  // in NotificationContext so all headers show the same data.
  const [isOpen, setIsOpen] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  // `useRef` stores the DOM element without causing a render when it changes.
  const rootReference = useRef(null);
  const notificationPagePath = getNotificationPagePath(user);

  useEffect(() => {
    /**
     * Closes the dropdown after an outside pointer action.
     * @param {MouseEvent} event - Browser mouse event.
     * @returns {void}
     * @sideEffects Updates dropdown state.
     */
    function handleOutsideClick(event) {
      const rootElement = rootReference.current;

      if (
        rootElement &&
        // `contains` checks whether the clicked DOM node is inside the bell.
        !rootElement.contains(event.target)
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

    // These browser listeners allow outside-click and keyboard dismissal.
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    // The cleanup prevents duplicate listeners after unmounting.
    return function removeDropdownListeners() {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  /**
   * Opens or closes the dropdown and refreshes its six newest records.
   * @param {void} _unused - This handler accepts no arguments.
   * @returns {Promise<void>} Resolves after an optional API request.
   * @sideEffects Updates dropdown state and may load notification data.
   */
  async function toggleMenu() {
    // Execution sequence:
    // 1. Toggle visibility and stop immediately when closing.
    // 2. Load the six-item preview only when opening.
    // 3. Keep shared errors/toasts consistent if loading fails.
    const shouldOpen = !isOpen;
    setIsOpen(shouldOpen);

    if (!shouldOpen) {
      return;
    }

    try {
      await loadNotifications({
        page: 1,
        limit: 6,
      });
    } catch {
      showToast("Notifications could not be loaded.", "error");
    }
  }

  /**
   * Marks one notification read before normal link navigation.
   * @param {object} notification - Selected notification.
   * @returns {Promise<void>} Resolves after the read attempt.
   * @sideEffects May update shared state and always closes the dropdown.
   */
  async function readNotification(notification) {
    // Execution sequence:
    // 1. Persist read state only when the item is currently unread.
    // 2. Close the menu and navigate to the role-safe related page.
    // 3. Report read failures without blocking navigation cleanup.
    try {
      if (!notification.isRead) {
        await markAsRead(notification._id);
      }
    } catch {
      showToast("The notification could not be marked read.", "error");
    } finally {
      setIsOpen(false);
    }
  }

  /**
   * Marks all caller-owned notifications read from the dropdown.
   * @param {void} _unused - This handler accepts no arguments.
   * @returns {Promise<void>} Resolves after the update attempt.
   * @sideEffects Calls the bulk API and updates shared notification state.
   */
  async function handleMarkAllRead() {
    // Execution sequence:
    // 1. Disable the bulk action while the shared context updates.
    // 2. Persist/readjust all notification state and show feedback.
    // 3. Restore the bulk button in finally.
    try {
      setIsMarkingAll(true);
      await markAllAsRead();
      showToast("All notifications marked as read.", "success");
    } catch {
      showToast("Notifications could not be updated.", "error");
    } finally {
      setIsMarkingAll(false);
    }
  }

  /**
   * Closes the dropdown after opening the full notification center.
   * @param {void} _unused - This handler accepts no arguments.
   * @returns {void}
   * @sideEffects Updates dropdown state.
   */
  function closeMenu() {
    setIsOpen(false);
  }

  let markAllLabel = "Mark all read";

  if (isMarkingAll) {
    markAllLabel = "Updating...";
  }

  return (
    <div className="notification-bell" ref={rootReference}>
      <button
        className="notification-bell__button"
        type="button"
        aria-label={"Notifications, " + unreadCount + " unread"}
        aria-expanded={isOpen}
        aria-haspopup="true"
        onClick={toggleMenu}
      >
        <BellIcon size={19} />

        {unreadCount > 0 && (
          <span className="notification-bell__count">
            {formatUnreadCount(unreadCount)}
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
                {markAllLabel}
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

            {!isLoading &&
              // `map` converts each notification object into one Link. `key`
              // lets React match the same item between renders.
              notifications.map((notification) => (
                <Link
                  className={getItemClassName(notification)}
                  to={getNotificationPath(notification, notificationPagePath)}
                  key={notification._id}
                  onClick={() => {
                    readNotification(notification);
                  }}
                >
                  <strong>{notification.title}</strong>
                  <span>{notification.message}</span>
                  <time>{formatNotificationTime(notification.createdAt)}</time>
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
