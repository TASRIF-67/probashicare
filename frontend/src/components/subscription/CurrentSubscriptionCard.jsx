import { Card } from "../Card.jsx";
import { CalendarIcon, ClockIcon, ShieldCheckIcon } from "../Icons.jsx";

/**
 * Formats a stored subscription timestamp.
 * @param {string|Date|null} value - Stored date value.
 * @returns {string} Localized date and time or Not available.
 * @sideEffects None.
 */
function formatDateTime(value) {
  if (!value) {
    return "Not available";
  }

  return new Date(value).toLocaleString();
}

/**
 * Describes the remaining subscription period without hiding the exact expiry.
 * @param {string|Date|null} expiryValue - Subscription expiry date.
 * @returns {string} Remaining days, hours, minutes, or expiry state.
 * @sideEffects Reads the current browser time.
 */
function formatRemainingTime(expiryValue) {
  if (!expiryValue) {
    return "No expiry for Core access";
  }

  const milliseconds = new Date(expiryValue).getTime() - Date.now();

  if (milliseconds <= 0) {
    return "Expired";
  }

  const totalMinutes = Math.ceil(milliseconds / (60 * 1000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return days + " day" + (days === 1 ? "" : "s") + ", " + hours + " hour" + (hours === 1 ? "" : "s") + " remaining";
  }

  if (hours > 0) {
    return hours + " hour" + (hours === 1 ? "" : "s") + ", " + minutes + " minute" + (minutes === 1 ? "" : "s") + " remaining";
  }

  return minutes + " minute" + (minutes === 1 ? "" : "s") + " remaining";
}

/**
 * Calculates elapsed-period progress for a visual subscription timeline.
 * @param {string|Date|null} startValue - Period activation time.
 * @param {string|Date|null} endValue - Period expiry time.
 * @returns {number} Percentage from zero through one hundred.
 * @sideEffects Reads the current browser time.
 */
function calculateProgress(startValue, endValue) {
  if (!startValue || !endValue) {
    return 0;
  }

  const start = new Date(startValue).getTime();
  const end = new Date(endValue).getTime();
  const duration = end - start;

  if (duration <= 0) {
    return 0;
  }

  const elapsed = Date.now() - start;
  const percentage = Math.round((elapsed / duration) * 100);
  return Math.min(100, Math.max(0, percentage));
}

/**
 * Presents the Family account's current plan, status, activation, expiry, and remaining period.
 * @param {{subscription: object|null, access: object|null}} props - Backend subscription record and effective access.
 * @returns {import("react").ReactElement} Enhanced current-plan summary card.
 * @sideEffects Reads current time for remaining-time and progress presentation.
 */
export function CurrentSubscriptionCard({ subscription, access }) {
  const isTrial = subscription?.status === "trialing";
  const planName =
    subscription?.planSnapshot?.name ||
    (isTrial ? "Seven-day free trial" : "Core family access");
  const startTime =
    subscription?.currentPeriodStartedAt ||
    subscription?.trialStartedAt ||
    null;
  const expiryTime = access?.expiresAt || subscription?.currentPeriodEndsAt || null;
  const progress = calculateProgress(startTime, expiryTime);
  const status = access?.status || subscription?.status || "none";

  return (
    <Card className="current-plan-card">
      <div className="current-plan-card__identity">
        <span className="current-plan-card__icon">
          <ShieldCheckIcon />
        </span>
        <div>
          <span className="eyebrow">{access?.accessLevel || "core"} access</span>
          <h2>{planName}</h2>
          <span className={"status-badge status-badge--" + status}>
            {status}
          </span>
        </div>
      </div>

      <div className="current-plan-card__dates">
        <div>
          <span><CalendarIcon size={17} /> Activated</span>
          <strong>{formatDateTime(startTime)}</strong>
        </div>
        <div>
          <span><ClockIcon size={17} /> Exact expiry</span>
          <strong>{formatDateTime(expiryTime)}</strong>
        </div>
      </div>

      {expiryTime && (
        <div className="current-plan-card__timeline">
          <div>
            <strong>{formatRemainingTime(expiryTime)}</strong>
            <span>{progress}% of the current period used</span>
          </div>
          <div
            className="current-plan-progress"
            role="progressbar"
            aria-label="Subscription period used"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={progress}
          >
            <span style={{ width: progress + "%" }} />
          </div>
        </div>
      )}

      {!expiryTime && (
        <p className="current-plan-card__core-note">
          Core access keeps existing care information available without an expiry date.
        </p>
      )}
    </Card>
  );
}
