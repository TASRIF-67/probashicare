/**
 * Returns the safest internal destination for a notification action.
 * New workflow notifications use actionPath, while older subscription
 * notifications may still use actionUrl.
 * @param {object} notification - Notification API record.
 * @param {string} fallbackPath - Role-appropriate notification-center path.
 * @returns {string} Internal React Router destination.
 * @sideEffects None.
 */
export function getNotificationPath(notification, fallbackPath) {
  // Optional chaining (`?.`) returns undefined instead of throwing when a
  // notification or property is missing. `trim` removes surrounding spaces.
  const actionPath = notification?.actionPath;

  if (typeof actionPath === "string" && actionPath.trim() !== "") {
    return actionPath;
  }

  const actionUrl = notification?.actionUrl;

  if (typeof actionUrl === "string" && actionUrl.trim() !== "") {
    return actionUrl;
  }

  return fallbackPath;
}

/**
 * Checks whether a notification supports reminder dismissal.
 * @param {object} notification - Notification API record.
 * @returns {boolean} True for trial or subscription expiry reminders.
 * @sideEffects None.
 */
export function isReminderNotification(notification) {
  // `String` safely converts undefined/null into text. The `||` fallback keeps
  // an absent type as an empty string.
  const type = String(notification?.type || "");

  // `includes` checks whether "expir" occurs anywhere in the type.
  if (type.includes("expir")) {
    return true;
  }

  return type === "trial_expiring";
}
