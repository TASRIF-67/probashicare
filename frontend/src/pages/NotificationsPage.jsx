import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "../components/AppHeader.jsx";
import { Card } from "../components/Card.jsx";
import { CaregiverHeader } from "../components/caregiver/CaregiverHeader.jsx";
import { BellIcon } from "../components/Icons.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useNotifications } from "../context/NotificationContext.jsx";

/**
 * Formats a notification date and time.
 * @param {string|Date} value - Stored notification time.
 * @returns {string} Localized date and time.
 * @sideEffects None.
 */
function formatDateTime(value) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return formatter.format(new Date(value));
}

/**
 * Displays notification history for a family member or approved caregiver.
 * @returns {import("react").ReactElement} Notification history page.
 * @sideEffects Loads notifications, marks records read, and navigates to actions.
 */
export function NotificationsPage() {
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
  const navigate = useNavigate();
  const Header =
    user.role === "caregiver"
      ? CaregiverHeader
      : AppHeader;
  const pageClassName =
    user.role === "caregiver"
      ? "caregiver-page notification-page"
      : "feature-page notification-page";

  useEffect(() => {
    loadNotifications({
      limit: 50,
    }).catch(() => {
      // The provider exposes the loading error on this page.
    });
  }, [loadNotifications]);

  /**
   * Opens the notification action after marking it read.
   * @param {object} notification - Selected notification record.
   * @returns {Promise<void>}
   * @sideEffects Updates notification state and changes route.
   */
  async function openNotification(notification) {
    if (!notification.readAt) {
      await markAsRead(notification._id);
    }

    if (notification.actionPath) {
      navigate(notification.actionPath);
    }
  }

  return (
    <main>
      <Header />
      <div className={pageClassName}>
        <div className="page-heading page-heading--action">
          <div>
            <span className="eyebrow">Updates</span>
            <h1>Notifications</h1>
            <p>
              Review booking decisions, care activity, and wellness updates.
            </p>
          </div>
          <button
            className="button button--secondary"
            type="button"
            disabled={!unreadCount}
            onClick={markAllAsRead}
          >
            Mark all as read
          </button>
        </div>

        {isLoading && (
          <div className="page-loader-inline">
            <span className="spinner" />
            Loading notifications
          </div>
        )}

        {error && (
          <div className="alert alert--error">
            {error}
          </div>
        )}

        {!isLoading && !notifications.length && (
          <Card className="empty-state">
            <span className="feature-icon">
              <BellIcon />
            </span>
            <h2>No notifications yet</h2>
            <p>Important booking and wellness updates will appear here.</p>
          </Card>
        )}

        <div className="notification-history">
          {notifications.map((notification) => (
            <button
              className={
                notification.readAt
                  ? "notification-history__item"
                  : "notification-history__item notification-history__item--unread"
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
              </span>
              <time dateTime={notification.createdAt}>
                {formatDateTime(notification.createdAt)}
              </time>
              {!notification.readAt && (
                <span className="notification-history__unread">
                  Unread
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
