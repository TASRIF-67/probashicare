import { useEffect, useState } from "react";
import { AppHeader } from "../components/AppHeader.jsx";
import { Button } from "../components/Button.jsx";
import { BellIcon } from "../components/Icons.jsx";
import { Pagination } from "../components/Pagination.jsx";
import { normalizeApiError } from "../services/api.js";
import { notificationService } from "../services/notificationService.js";

/**
 * Displays authenticated notification history and reminder actions.
 * @returns {import("react").ReactElement} Family notification center.
 * @sideEffects Loads, reads, and dismisses caller-owned notifications.
 */
export function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [state, setState] = useState({
    loading: true,
    notifications: [],
    error: "",
    busyId: "",
    pagination: null,
  });

  /** Loads notification history. @returns {Promise<void>} @sideEffects Calls API and updates state. */
  async function loadNotifications() {
    try {
      const data = await notificationService.list({ page, limit: 3 });
      setState((current) => ({
        ...current,
        loading: false,
        notifications: data.notifications,
        error: "",
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: normalizeApiError(error).message,
      }));
    }
  }

  useEffect(() => {
    loadNotifications();
  }, [page]);

  /** Marks one notification read. @param {string} id - Notification ID. @returns {Promise<void>} @sideEffects Calls API and reloads list. */
  async function markRead(id) {
    setState((current) => ({ ...current, busyId: id }));
    await notificationService.markRead(id);
    await loadNotifications();
    setState((current) => ({ ...current, busyId: "" }));
  }

  /** Dismisses one reminder for 24 hours. @param {string} id - Notification ID. @returns {Promise<void>} @sideEffects Calls API and reloads list. */
  async function dismiss(id) {
    setState((current) => ({ ...current, busyId: id }));
    await notificationService.dismiss(id, 24);
    await loadNotifications();
    setState((current) => ({ ...current, busyId: "" }));
  }

  return (
    <main>
      <AppHeader />
      <div className="feature-page">
        <div className="page-heading">
          <span className="eyebrow">Family updates</span>
          <h1>Notifications</h1>
          <p>Review subscription expiry and prototype payment updates.</p>
        </div>
        {state.loading && <div className="page-loader-inline"><span className="spinner" /> Loading notifications</div>}
        {state.error && <div className="alert alert--error">{state.error}</div>}
        {!state.loading && !state.notifications.length && <div className="empty-state"><BellIcon /><h2>No notifications yet</h2></div>}
        <div className="notification-history">
          {state.notifications.map((notification) => (
            <article className={"notification-history__item " + (!notification.isRead ? "notification-history__item--unread" : "")} key={notification._id}>
              <div><strong>{notification.title}</strong><p>{notification.message}</p><time>{new Date(notification.createdAt).toLocaleString()}</time></div>
              <div className="notification-history__actions">
                {!notification.isRead && <Button variant="secondary" isLoading={state.busyId === notification._id} onClick={() => markRead(notification._id)}>Mark read</Button>}
                {notification.type.includes("expir") && <Button variant="ghost" disabled={Boolean(state.busyId)} onClick={() => dismiss(notification._id)}>Remind me later</Button>}
              </div>
            </article>
          ))}
        </div>
        {state.pagination && <Pagination page={state.pagination.page} pages={state.pagination.pages} total={state.pagination.total} label="notifications" disabled={state.loading} onPageChange={setPage} />}
      </div>
    </main>
  );
}
