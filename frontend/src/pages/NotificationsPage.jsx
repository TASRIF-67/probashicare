import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "../components/AppHeader.jsx";
import { CaregiverHeader } from "../components/caregiver/CaregiverHeader.jsx";
import { Button } from "../components/Button.jsx";
import {
  BellIcon,
  CheckIcon,
  ChevronRightIcon,
} from "../components/Icons.jsx";
import { Pagination } from "../components/Pagination.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useNotifications } from "../context/NotificationContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { normalizeApiError } from "../services/api.js";
import { notificationService } from "../services/notificationService.js";
import {
  getNotificationPath,
  isReminderNotification,
} from "../utils/notificationHelpers.js";

const PAGE_SIZE = 3;

/**
 * Formats a notification date using the current browser locale.
 * @param {string|Date} value - Stored notification date.
 * @returns {string} Readable date and time.
 * @sideEffects None.
 */
function formatNotificationDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Displays paginated caller-owned notifications with read controls.
 * @param {void} _unused - This component accepts no props.
 * @returns {import("react").ReactElement} Role-aware notification center.
 * @sideEffects Loads, reads, opens, and dismisses notifications.
 */
export function NotificationsPage() {
  const { user } = useAuth();
  const { refreshUnreadCount } = useNotifications();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("all");
  const [state, setState] = useState({
    loading: true,
    notifications: [],
    unreadCount: 0,
    error: "",
    busyId: "",
    busyAll: false,
    pagination: {
      page: 1,
      pages: 1,
      total: 0,
      limit: PAGE_SIZE,
    },
  });
  const isCaregiver = user?.role === "caregiver";
  const fallbackPath = isCaregiver
    ? "/caregiver/notifications"
    : "/notifications";
  const HeaderComponent = isCaregiver
    ? CaregiverHeader
    : AppHeader;

  /**
   * Loads the active notification page and filter.
   * @param {boolean} [showLoading=true] - Whether to show the page loader.
   * @returns {Promise<void>}
   * @sideEffects Calls the list API and updates page state.
   */
  async function loadNotifications(showLoading = true) {
    if (showLoading) {
      setState((currentState) => ({
        ...currentState,
        loading: true,
      }));
    }

    try {
      const params = {
        page,
        limit: PAGE_SIZE,
      };

      if (filter === "unread") {
        params.unread = true;
      }

      const data = await notificationService.list(params);
      const pagination = data.pagination || {
        page,
        pages: 1,
        total: data.notifications.length,
        limit: PAGE_SIZE,
      };

      if (
        pagination.pages > 0
        && page > pagination.pages
      ) {
        setPage(pagination.pages);
        return;
      }

      setState((currentState) => ({
        ...currentState,
        loading: false,
        notifications: data.notifications,
        unreadCount: data.unreadCount,
        pagination,
        error: "",
      }));
    } catch (error) {
      setState((currentState) => ({
        ...currentState,
        loading: false,
        error: normalizeApiError(error).message,
      }));
    }
  }

  useEffect(() => {
    loadNotifications();
  }, [page, filter]);

  /**
   * Changes between all and unread notification views.
   * @param {"all"|"unread"} nextFilter - Selected list filter.
   * @returns {void}
   * @sideEffects Updates filter and pagination state.
   */
  function changeFilter(nextFilter) {
    setFilter(nextFilter);
    setPage(1);
  }

  /**
   * Marks one notification read and refreshes counts.
   * @param {string} notificationId - Notification identifier.
   * @returns {Promise<void>}
   * @sideEffects Calls the read API and reloads notification data.
   */
  async function markRead(notificationId) {
    try {
      setState((currentState) => ({
        ...currentState,
        busyId: notificationId,
      }));
      await notificationService.markRead(notificationId);
      await loadNotifications(false);
      await refreshUnreadCount();
    } catch (error) {
      showToast(
        normalizeApiError(error).message,
        "error",
      );
    } finally {
      setState((currentState) => ({
        ...currentState,
        busyId: "",
      }));
    }
  }

  /**
   * Marks every caller-owned notification read.
   * @returns {Promise<void>}
   * @sideEffects Calls the bulk API, reloads the current page, and refreshes the bell count.
   */
  async function markAllRead() {
    try {
      setState((currentState) => ({
        ...currentState,
        busyAll: true,
      }));
      await notificationService.markAllAsRead();

      if (filter === "unread" && page !== 1) {
        setPage(1);
      } else {
        await loadNotifications(false);
      }

      await refreshUnreadCount();
      showToast(
        "All notifications marked as read.",
        "success",
      );
    } catch (error) {
      showToast(
        normalizeApiError(error).message,
        "error",
      );
    } finally {
      setState((currentState) => ({
        ...currentState,
        busyAll: false,
      }));
    }
  }

  /**
   * Marks a notification read and opens its related feature.
   * @param {object} notification - Selected notification record.
   * @returns {Promise<void>}
   * @sideEffects May call the read API and changes the current route.
   */
  async function openNotification(notification) {
    try {
      setState((currentState) => ({
        ...currentState,
        busyId: notification._id,
      }));

      if (!notification.isRead) {
        await notificationService.markRead(notification._id);
        await refreshUnreadCount();
      }

      navigate(
        getNotificationPath(notification, fallbackPath),
      );
    } catch (error) {
      showToast(
        normalizeApiError(error).message,
        "error",
      );
      setState((currentState) => ({
        ...currentState,
        busyId: "",
      }));
    }
  }

  /**
   * Dismisses an expiry reminder for twenty-four hours.
   * @param {string} notificationId - Notification identifier.
   * @returns {Promise<void>}
   * @sideEffects Calls the dismissal API and reloads data.
   */
  async function dismiss(notificationId) {
    try {
      setState((currentState) => ({
        ...currentState,
        busyId: notificationId,
      }));
      await notificationService.dismiss(
        notificationId,
        24,
      );
      await loadNotifications(false);
      showToast(
        "Reminder paused for 24 hours.",
        "success",
      );
    } catch (error) {
      showToast(
        normalizeApiError(error).message,
        "error",
      );
    } finally {
      setState((currentState) => ({
        ...currentState,
        busyId: "",
      }));
    }
  }

  return (
    <main>
      <HeaderComponent />
      <div className="feature-page notification-center">
        <section className="notification-center__hero">
          <div className="notification-center__title">
            <span aria-hidden="true">
              <BellIcon size={23} />
            </span>
            <div>
              <span className="eyebrow">
                Care activity
              </span>
              <h1>Your notifications</h1>
              <p>
                Booking responses, wellness updates,
                reminders, and care coordination activity.
              </p>
            </div>
          </div>

          <div className="notification-center__summary">
            <strong>{state.unreadCount}</strong>
            <span>Unread updates</span>
          </div>
        </section>

        <section className="notification-center__toolbar">
          <div
            className="notification-filter"
            role="tablist"
            aria-label="Notification filters"
          >
            <button
              type="button"
              role="tab"
              aria-selected={filter === "all"}
              className={
                filter === "all"
                  ? "notification-filter__button notification-filter__button--active"
                  : "notification-filter__button"
              }
              onClick={() => changeFilter("all")}
            >
              All notifications
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === "unread"}
              className={
                filter === "unread"
                  ? "notification-filter__button notification-filter__button--active"
                  : "notification-filter__button"
              }
              onClick={() => changeFilter("unread")}
            >
              Unread
              <span>{state.unreadCount}</span>
            </button>
          </div>

          <Button
            variant="secondary"
            isLoading={state.busyAll}
            disabled={
              state.unreadCount === 0
              || Boolean(state.busyId)
            }
            onClick={markAllRead}
          >
            <CheckIcon size={17} />
            Mark all as read
          </Button>
        </section>

        {state.error && (
          <div className="alert alert--error" role="alert">
            {state.error}
          </div>
        )}

        {state.loading ? (
          <div className="notification-center__loading">
            <span className="spinner" />
            Loading notifications...
          </div>
        ) : state.notifications.length === 0 ? (
          <div className="notification-center__empty">
            <span aria-hidden="true">
              <BellIcon size={26} />
            </span>
            <h2>
              {filter === "unread"
                ? "You are all caught up"
                : "No notifications yet"}
            </h2>
            <p>
              {filter === "unread"
                ? "There are no unread care updates."
                : "New care activity will appear here."}
            </p>
          </div>
        ) : (
          <div className="notification-history">
            {state.notifications.map((notification) => {
              const isBusy =
                state.busyId === notification._id;

              return (
                <article
                  className={
                    notification.isRead
                      ? "notification-history__item"
                      : "notification-history__item notification-history__item--unread"
                  }
                  key={notification._id}
                >
                  <span
                    className="notification-history__icon"
                    aria-hidden="true"
                  >
                    {notification.isRead ? (
                      <CheckIcon size={17} />
                    ) : (
                      <BellIcon size={17} />
                    )}
                  </span>

                  <div className="notification-history__content">
                    <div>
                      <strong>{notification.title}</strong>
                      {!notification.isRead && (
                        <span>New</span>
                      )}
                    </div>
                    <p>{notification.message}</p>
                    <time>
                      {formatNotificationDate(
                        notification.createdAt,
                      )}
                    </time>
                  </div>

                  <div className="notification-history__actions">
                    {!notification.isRead && (
                      <Button
                        variant="secondary"
                        disabled={Boolean(state.busyAll)}
                        isLoading={isBusy}
                        onClick={() =>
                          markRead(notification._id)
                        }
                      >
                        Mark read
                      </Button>
                    )}
                    {isReminderNotification(notification) && (
                      <Button
                        variant="ghost"
                        disabled={
                          isBusy
                          || Boolean(state.busyAll)
                        }
                        onClick={() =>
                          dismiss(notification._id)
                        }
                      >
                        Remind later
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      disabled={
                        isBusy
                        || Boolean(state.busyAll)
                      }
                      onClick={() =>
                        openNotification(notification)
                      }
                    >
                      Open
                      <ChevronRightIcon size={16} />
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <Pagination
          page={state.pagination.page}
          pages={state.pagination.pages}
          total={state.pagination.total}
          label="notifications"
          disabled={state.loading}
          onPageChange={setPage}
        />
      </div>
    </main>
  );
}
