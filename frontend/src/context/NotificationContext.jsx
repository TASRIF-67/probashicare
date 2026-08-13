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

const NotificationContext = createContext(null);
const POLLING_INTERVAL_MS = 15000;

/**
 * Provides notification data and actions for the authenticated application.
 * @param {{children: import("react").ReactNode}} props - Descendant application tree.
 * @returns {import("react").ReactElement} Notification context provider.
 * @sideEffects Polls unread count and calls notification APIs.
 */
export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  /**
   * Refreshes only the small unread-count value.
   * @returns {Promise<void>}
   * @sideEffects Calls the unread-count API and updates context state.
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
      // Polling failures remain silent so they do not interrupt other workflows.
    }
  }, [user]);

  /**
   * Loads recent notifications for the dropdown or history view.
   * @param {{page?: number, limit?: number, status?: "all"|"unread"}} [options] - List filters.
   * @returns {Promise<object>} Loaded API data.
   * @sideEffects Calls the list API and updates context state.
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
        setError("Notifications could not be loaded.");
        throw new Error("Notifications could not be loaded.");
      } finally {
        setIsLoading(false);
      }
    },
    [user],
  );

  /**
   * Marks one notification read in the API and local state.
   * @param {string} notificationId - Notification identifier.
   * @returns {Promise<void>}
   * @sideEffects Calls the update API and changes context state.
   */
  const markAsRead = useCallback(async (notificationId) => {
    const data = await notificationService.markAsRead(notificationId);

    setNotifications((current) => {
      const updated = [];

      for (const notification of current) {
        if (notification._id === notificationId) {
          updated.push(data.notification);
        } else {
          updated.push(notification);
        }
      }

      return updated;
    });

    setUnreadCount((current) => {
      return Math.max(0, current - 1);
    });
  }, []);

  /**
   * Marks all current-user notifications read.
   * @returns {Promise<void>}
   * @sideEffects Calls the bulk API and updates context state.
   */
  const markAllAsRead = useCallback(async () => {
    await notificationService.markAllAsRead();
    const readAt = new Date().toISOString();

    setNotifications((current) => {
      const updated = [];

      for (const notification of current) {
        updated.push({
          ...notification,
          readAt: notification.readAt || readAt,
        });
      }

      return updated;
    });
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return undefined;
    }

    refreshUnreadCount();

    const intervalId = window.setInterval(() => {
      refreshUnreadCount();
    }, POLLING_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshUnreadCount, user]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      isLoading,
      error,
      loadNotifications,
      refreshUnreadCount,
      markAsRead,
      markAllAsRead,
    }),
    [
      notifications,
      unreadCount,
      isLoading,
      error,
      loadNotifications,
      refreshUnreadCount,
      markAsRead,
      markAllAsRead,
    ],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

/**
 * Reads notification data and actions from NotificationProvider.
 * @returns {object} Notification context value.
 * @sideEffects None.
 */
export function useNotifications() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error("useNotifications must be used inside NotificationProvider.");
  }

  return context;
}
