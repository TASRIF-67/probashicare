import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "../components/AppHeader.jsx";
import { CaregiverHeader } from "../components/caregiver/CaregiverHeader.jsx";
import { Button } from "../components/Button.jsx";
import { BellIcon, CheckIcon, ChevronRightIcon } from "../components/Icons.jsx";
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
 * @returns {string} Readable date and time, or a safe fallback.
 * @sideEffects None.
 */
function formatNotificationDate(value) {
  const date = new Date(value);

  // `getTime` returns milliseconds. An invalid Date returns NaN.
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  // `toLocaleString` uses the browser's language and time zone.
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Creates the CSS class for a selected or unselected filter.
 * @param {boolean} isActive - Whether this filter is selected.
 * @returns {string} Filter button class name.
 * @sideEffects None.
 */
function getFilterButtonClass(isActive) {
  if (isActive) {
    return [
      "notification-filter__button",
      "notification-filter__button--active",
    ].join(" ");
  }

  return "notification-filter__button";
}

/**
 * Creates the CSS class for a read or unread history row.
 * @param {object} notification - Notification API record.
 * @returns {string} History row class name.
 * @sideEffects None.
 */
function getHistoryItemClass(notification) {
  if (notification.isRead) {
    return "notification-history__item";
  }

  return [
    "notification-history__item",
    "notification-history__item--unread",
  ].join(" ");
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

  // Related page values are grouped in one object so a successful request can
  // replace them together. Functional setters below preserve unchanged fields.
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
  let fallbackPath = "/notifications";
  let HeaderComponent = AppHeader;

  if (isCaregiver) {
    fallbackPath = "/caregiver/notifications";
    HeaderComponent = CaregiverHeader;
  }

  /**
   * Loads the active notification page and filter.
   * @param {boolean} [showLoading=true] - Whether to show the page loader.
   * @returns {Promise<void>} Resolves after state is updated.
   * @sideEffects Calls the list API and updates page state.
   */
  const loadNotifications = useCallback(
    async (showLoading = true) => {
      // Execution sequence:
      // 1. Optionally keep current records while marking the page loading.
      // 2. Request the active filter/page and store records plus pagination.
      // 3. Normalize errors and finish loading for the latest effect.
      if (showLoading) {
        setState((currentState) => {
          return {
            ...currentState,
            loading: true,
          };
        });
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

        let pagination = data.pagination;

        if (!pagination) {
          pagination = {
            page,
            pages: 1,
            total: data.notifications.length,
            limit: PAGE_SIZE,
          };
        }

        // If deleting/filtering data leaves the page outside the last page,
        // changing page triggers the effect again with a valid page number.
        if (pagination.pages > 0 && page > pagination.pages) {
          setPage(pagination.pages);
          return;
        }

        setState((currentState) => {
          return {
            ...currentState,
            loading: false,
            notifications: data.notifications,
            unreadCount: data.unreadCount,
            pagination,
            error: "",
          };
        });
      } catch (requestError) {
        // `normalizeApiError` converts Axios/network/backend errors into the
        // same safe shape used throughout the frontend.
        const normalizedError = normalizeApiError(requestError);

        setState((currentState) => {
          return {
            ...currentState,
            loading: false,
            error: normalizedError.message,
          };
        });
      }
    },
    [filter, page],
  );

  useEffect(() => {
    // The effect callback itself is not async, so it returns undefined instead
    // of a Promise. The async function is called inside it.
    loadNotifications();
  }, [loadNotifications]);

  /**
   * Changes between all and unread notification views.
   * @param {"all"|"unread"} nextFilter - Selected list filter.
   * @returns {void}
   * @sideEffects Updates filter and resets pagination.
   */
  function changeFilter(nextFilter) {
    setFilter(nextFilter);
    setPage(1);
  }

  /**
   * Marks one notification read and refreshes counts.
   * @param {string} notificationId - MongoDB Notification identifier.
   * @returns {Promise<void>} Resolves after data is refreshed.
   * @sideEffects Calls APIs and updates page/context state.
   */
  async function markRead(notificationId) {
    try {
      setState((currentState) => {
        return {
          ...currentState,
          busyId: notificationId,
        };
      });

      await notificationService.markRead(notificationId);
      await loadNotifications(false);
      await refreshUnreadCount();
    } catch (requestError) {
      const normalizedError = normalizeApiError(requestError);

      showToast(normalizedError.message, "error");
    } finally {
      setState((currentState) => {
        return {
          ...currentState,
          busyId: "",
        };
      });
    }
  }

  /**
   * Marks every caller-owned notification read.
   * @param {void} _unused - This handler accepts no arguments.
   * @returns {Promise<void>} Resolves after data and counts are refreshed.
   * @sideEffects Calls APIs and updates page/context state.
   */
  async function markAllRead() {
    try {
      // Step 1: Enter the page-wide notification action state.
      setState((currentState) => {
        return {
          ...currentState,
          busyAll: true,
        };
      });

      // Step 2: Persist the caller-owned bulk update in the backend.
      await notificationService.markAllAsRead();

      // Step 3: Reload the correct page after unread records disappear.
      if (filter === "unread" && page !== 1) {
        // Changing page causes the effect to load the first unread page.
        setPage(1);
      } else {
        await loadNotifications(false);
      }

      // Step 4: Synchronize the shared navigation-bell count.
      await refreshUnreadCount();

      // Step 5: Confirm success only after page and context state agree.
      showToast("All notifications marked as read.", "success");
    } catch (requestError) {
      const normalizedError = normalizeApiError(requestError);

      showToast(normalizedError.message, "error");
    } finally {
      setState((currentState) => {
        return {
          ...currentState,
          busyAll: false,
        };
      });
    }
  }

  /**
   * Marks a notification read and opens its related feature.
   * @param {object} notification - Selected Notification record.
   * @returns {Promise<void>} Resolves after navigation or error handling.
   * @sideEffects May call the read API and changes the current route.
   */
  async function openNotification(notification) {
    // Execution sequence:
    // 1. Mark the chosen row busy and persist read state when necessary.
    // 2. Refresh page/bell data before navigating to its safe action path.
    // 3. Clear busy state after success or failure.
    try {
      setState((currentState) => {
        return {
          ...currentState,
          busyId: notification._id,
        };
      });

      if (!notification.isRead) {
        await notificationService.markRead(notification._id);
        await refreshUnreadCount();
      }

      const destination = getNotificationPath(notification, fallbackPath);

      // `navigate` changes the React Router route without reloading the page.
      navigate(destination);
    } catch (requestError) {
      const normalizedError = normalizeApiError(requestError);

      showToast(normalizedError.message, "error");

      setState((currentState) => {
        return {
          ...currentState,
          busyId: "",
        };
      });
    }
  }

  /**
   * Dismisses an expiry reminder for twenty-four hours.
   * @param {string} notificationId - MongoDB Notification identifier.
   * @returns {Promise<void>} Resolves after data is refreshed.
   * @sideEffects Calls the dismissal API and updates page state.
   */
  async function dismiss(notificationId) {
    // Execution sequence:
    // 1. Mark one reminder row busy.
    // 2. Persist the dismissal window and reload caller-owned records.
    // 3. Refresh the bell count and always clear busy state.
    try {
      setState((currentState) => {
        return {
          ...currentState,
          busyId: notificationId,
        };
      });

      await notificationService.dismiss(notificationId, 24);
      await loadNotifications(false);

      showToast("Reminder paused for 24 hours.", "success");
    } catch (requestError) {
      const normalizedError = normalizeApiError(requestError);

      showToast(normalizedError.message, "error");
    } finally {
      setState((currentState) => {
        return {
          ...currentState,
          busyId: "",
        };
      });
    }
  }

  /**
   * Builds the loading, empty, or notification-list section.
   * @param {void} _unused - This renderer accepts no arguments.
   * @returns {import("react").ReactElement} Current notification page content.
   * @sideEffects None; button callbacks may perform actions after user input.
   */
  function renderNotificationContent() {
    if (state.loading) {
      return (
        <div className="notification-center__loading">
          <span className="spinner" />
          Loading notifications...
        </div>
      );
    }

    if (state.notifications.length === 0) {
      let emptyTitle = "No notifications yet";
      let emptyMessage = "New care activity will appear here.";

      if (filter === "unread") {
        emptyTitle = "You are all caught up";
        emptyMessage = "There are no unread care updates.";
      }

      return (
        <div className="notification-center__empty">
          <span aria-hidden="true">
            <BellIcon size={26} />
          </span>
          <h2>{emptyTitle}</h2>
          <p>{emptyMessage}</p>
        </div>
      );
    }

    const notificationCards = [];

    for (const notification of state.notifications) {
      const isBusy = state.busyId === notification._id;
      const busyAll = Boolean(state.busyAll);

      // `push` adds one React element to the end of the cards array.
      notificationCards.push(
        <article
          className={getHistoryItemClass(notification)}
          key={notification._id}
        >
          <span className="notification-history__icon" aria-hidden="true">
            {notification.isRead ? (
              <CheckIcon size={17} />
            ) : (
              <BellIcon size={17} />
            )}
          </span>

          <div className="notification-history__content">
            <div>
              <strong>{notification.title}</strong>

              {!notification.isRead && <span>New</span>}
            </div>

            <p>{notification.message}</p>

            <time>{formatNotificationDate(notification.createdAt)}</time>
          </div>

          <div className="notification-history__actions">
            {!notification.isRead && (
              <Button
                variant="secondary"
                disabled={busyAll}
                isLoading={isBusy}
                onClick={() => {
                  markRead(notification._id);
                }}
              >
                Mark read
              </Button>
            )}

            {isReminderNotification(notification) && (
              <Button
                variant="ghost"
                disabled={isBusy || busyAll}
                onClick={() => {
                  dismiss(notification._id);
                }}
              >
                Remind later
              </Button>
            )}

            <Button
              variant="ghost"
              disabled={isBusy || busyAll}
              onClick={() => {
                openNotification(notification);
              }}
            >
              Open
              <ChevronRightIcon size={16} />
            </Button>
          </div>
        </article>,
      );
    }

    return <div className="notification-history">{notificationCards}</div>;
  }

  const allFilterIsActive = filter === "all";
  const unreadFilterIsActive = filter === "unread";
  const hasBusyNotification = Boolean(state.busyId);
  const disableMarkAll = state.unreadCount === 0 || hasBusyNotification;

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
              <span className="eyebrow">Care activity</span>
              <h1>Your notifications</h1>
              <p>
                Booking responses, wellness updates, reminders, and care
                coordination activity.
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
              aria-selected={allFilterIsActive}
              className={getFilterButtonClass(allFilterIsActive)}
              onClick={() => {
                changeFilter("all");
              }}
            >
              All notifications
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={unreadFilterIsActive}
              className={getFilterButtonClass(unreadFilterIsActive)}
              onClick={() => {
                changeFilter("unread");
              }}
            >
              Unread
              <span>{state.unreadCount}</span>
            </button>
          </div>

          <Button
            variant="secondary"
            isLoading={state.busyAll}
            disabled={disableMarkAll}
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

        {renderNotificationContent()}

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
