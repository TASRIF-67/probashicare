import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { notificationService } from "../services/notificationService.js";
import { useAuth } from "./AuthContext.jsx";

// `createContext` creates a shared React value. The initial null helps the
// custom hook detect when a component is outside NotificationProvider.
const NotificationContext = createContext(null);

// The bell checks for a new unread count every fifteen seconds.
const POLLING_INTERVAL_MS = 15 * 1000;

/**
 * Provides notification data and actions to authenticated descendants.
 * @param {{children: import("react").ReactNode}} props - Descendant React tree.
 * @returns {import("react").ReactElement} Notification context provider.
 * @sideEffects Polls the API, performs notification requests, and updates React state.
 */
export function NotificationProvider({ children }) {
  const { user } = useAuth();

  // `useState` returns the current value and a setter. Calling a setter asks
  // React to render consumers again with the new value.
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  /**
   * Refreshes only the small unread-count value used by the bell.
   * @param {void} _unused - This function accepts no arguments.
   * @returns {Promise<void>} Resolves after the count is updated or skipped.
   * @sideEffects Calls the unread-count API and updates React state.
   */
  const refreshUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    try {
      const data = await notificationService.getUnreadCount();
      setUnreadCount(data.unreadCount);
    } catch {
      // Polling is background work. A temporary failure stays silent so it
      // does not interrupt the page the user is currently using.
    }
  }, [user]);

  /**
   * Loads notifications for the dropdown or another context consumer.
   * @param {{page?: number, limit?: number, unread?: boolean}} [options] - List query values.
   * @returns {Promise<{
   *   notifications: object[],
   *   unreadCount: number,
   *   pagination: object
   * }>} Data returned by the notification API.
   * @sideEffects Calls the list API and updates shared React state.
   */
  const loadNotifications = useCallback(
    async (options = {}) => {
      if (!user) {
        return {
          notifications: [],
          unreadCount: 0,
          pagination: {},
        };
      }

      setIsLoading(true);
      setError("");

      try {
        const data = await notificationService.listNotifications(options);

        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);

        return data;
      } catch {
        const message = "Notifications could not be loaded.";
        setError(message);

        // Throwing a new Error rejects this async function's Promise. The bell
        // catches it and displays a toast without exposing backend details.
        throw new Error(message);
      } finally {
        // `finally` runs after success or failure, so loading cannot remain on.
        setIsLoading(false);
      }
    },
    [user],
  );

  /**
   * Marks one notification read in the API and local state.
   * @param {string} notificationId - MongoDB Notification identifier.
   * @returns {Promise<void>} Resolves after remote and local state are updated.
   * @sideEffects Sends a PATCH request and updates shared React state.
   */
  const markAsRead = useCallback(async (notificationId) => {
    const data = await notificationService.markAsRead(notificationId);

    // A functional state update receives the latest state. This avoids a stale
    // array when two notification actions finish close together.
    setNotifications((currentNotifications) => {
      const updatedNotifications = [];

      for (const notification of currentNotifications) {
        if (notification._id === notificationId) {
          updatedNotifications.push(data.notification);
        } else {
          updatedNotifications.push(notification);
        }
      }

      return updatedNotifications;
    });

    setUnreadCount((currentUnreadCount) => {
      // `Math.max` prevents the displayed count from becoming negative.
      return Math.max(0, currentUnreadCount - 1);
    });
  }, []);

  /**
   * Marks all current-user notifications read.
   * @param {void} _unused - This function accepts no arguments.
   * @returns {Promise<void>} Resolves after remote and local state are updated.
   * @sideEffects Sends a bulk PATCH request and updates shared React state.
   */
  const markAllAsRead = useCallback(async () => {
    const data = await notificationService.markAllAsRead();

    // `||` uses the local ISO date only if an older backend omitted readAt.
    // `toISOString` converts Date into a standard UTC string.
    const readAt = data.readAt || new Date().toISOString();

    setNotifications((currentNotifications) => {
      const updatedNotifications = [];

      for (const notification of currentNotifications) {
        updatedNotifications.push({
          // Object spread copies the existing record before replacing fields.
          ...notification,
          isRead: true,
          readAt: notification.readAt || readAt,
        });
      }

      return updatedNotifications;
    });

    setUnreadCount(0);
  }, []);

  useEffect(() => {
    // `useEffect` runs after rendering. Its return value must be either a
    // cleanup function or undefined; it must never be an async Promise.
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return undefined;
    }

    refreshUnreadCount();

    // `setInterval` repeats the callback until its numeric ID is cleared.
    const intervalId = window.setInterval(
      refreshUnreadCount,
      POLLING_INTERVAL_MS,
    );

    // React calls this cleanup before dependencies change and on unmount.
    return function stopNotificationPolling() {
      window.clearInterval(intervalId);
    };
  }, [refreshUnreadCount, user]);

  // `useMemo` keeps the same object identity while all listed values remain
  // unchanged. This avoids rendering every context consumer for no reason.
  const contextValue = useMemo(() => {
    return {
      notifications,
      unreadCount,
      isLoading,
      error,
      loadNotifications,
      refreshUnreadCount,
      markAsRead,
      markAllAsRead,
    };
  }, [
    notifications,
    unreadCount,
    isLoading,
    error,
    loadNotifications,
    refreshUnreadCount,
    markAsRead,
    markAllAsRead,
  ]);

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}

/**
 * Reads notification state and actions from NotificationProvider.
 * @param {void} _unused - This hook accepts no arguments.
 * @returns {{
 *   notifications: object[],
 *   unreadCount: number,
 *   isLoading: boolean,
 *   error: string,
 *   loadNotifications: Function,
 *   refreshUnreadCount: Function,
 *   markAsRead: Function,
 *   markAllAsRead: Function
 * }} The current notification context value.
 * @sideEffects Subscribes the calling component to context updates.
 */
export function useNotifications() {
  // `useContext` reads the nearest provider value and subscribes to changes.
  const contextValue = useContext(NotificationContext);

  if (!contextValue) {
    throw new Error(
      "useNotifications must be used inside NotificationProvider.",
    );
  }

  return contextValue;
}
