/**
 * Returns the safest destination for a notification action.
 * New workflow notifications use actionPath, while older subscription
 * notifications may still use actionUrl.
 * @param {object} notification - Notification API record.
 * @param {string} fallbackPath - Role-appropriate notification-center path.
 * @returns {string} Internal React Router destination.
 * @sideEffects None.
 */
export function getNotificationPath(
  notification,
  fallbackPath,
) {
  if (
    typeof notification?.actionPath === "string"
    && notification.actionPath.trim()
  ) {
    return notification.actionPath;
  }

  if (
    typeof notification?.actionUrl === "string"
    && notification.actionUrl.trim()
  ) {
    return notification.actionUrl;
  }

  return fallbackPath;
}

/**
 * Checks whether a notification supports the reminder dismissal action.
 * @param {object} notification - Notification API record.
 * @returns {boolean} True for trial or subscription expiry reminders.
 * @sideEffects None.
 */
export function isReminderNotification(notification) {
  const type = String(notification?.type || "");

  return (
    type.includes("expir")
    || type === "trial_expiring"
  );
}
