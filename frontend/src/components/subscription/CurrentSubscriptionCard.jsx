import { Card } from "../Card.jsx";
import { CalendarIcon, ClockIcon, ShieldCheckIcon } from "../Icons.jsx";

/**
 * Separates a stored subscription timestamp into readable date and time labels.
 * @param {string|Date|null} value - Stored date value.
 * @returns {{date: string, time: string}} Localized date and exact local time labels.
 * @sideEffects None.
 */
function formatDateParts(value) {
  if (!value) {
    return {
      date: "Not available",
      time: "Time unavailable",
    };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return {
      date: "Not available",
      time: "Time unavailable",
    };
  }

  return {
    date: date.toLocaleDateString(undefined, {
      dateStyle: "medium",
    }),
    time: date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
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
  const startDisplay = formatDateParts(startTime);
  const expiryDisplay = formatDateParts(expiryTime);
  const isExpired = expiryTime
    ? new Date(expiryTime).getTime() <= Date.now()
    : false;

  return (
    <Card className="current-plan-card">
      <header className="current-plan-card__header">
        <div className="current-plan-card__identity">
          <span className="current-plan-card__icon">
            <ShieldCheckIcon />
          </span>
          <div>
            <span className="eyebrow">{access?.accessLevel || "core"} access</span>
            <span className="current-plan-card__name-row">
              <h2>{planName}</h2>
              <span className={"status-badge status-badge--" + status}>
                {status}
              </span>
            </span>
          </div>
        </div>
        <a className="current-plan-card__action" href="#plan-options-title">
          {expiryTime ? "Manage plan" : "Choose a plan"}
          <span aria-hidden="true">→</span>
        </a>
      </header>

      {expiryTime && (
        <div className="current-plan-card__period">
          <div className="current-plan-card__period-summary">
            <strong>{formatRemainingTime(expiryTime)}</strong>
            <span>{progress}% of the current access period used</span>
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

          <div className="current-plan-card__dates">
            <div>
              <span><CalendarIcon size={15} /> Activated</span>
              <strong>{startDisplay.date}</strong>
              <small>{startDisplay.time}</small>
            </div>
            <div>
              <span><ClockIcon size={15} /> Exact expiry</span>
              <strong>{expiryDisplay.date}</strong>
              <small>{expiryDisplay.time}</small>
            </div>
          </div>

          <p className="current-plan-card__renewal-note">
            Manual renewal: Premium access remains available until the exact expiry shown above.
          </p>
        </div>
      )}

      {!expiryTime && (
        <p className="current-plan-card__core-note">
          Core access keeps existing care information available without an expiry date.
        </p>
      )}

      <footer className="current-plan-card__assurance">
        <span>
          <ShieldCheckIcon size={16} />
          {isExpired
            ? "This access period has ended. Choose a plan to restore Premium access."
            : "Your current care access continues uninterrupted until the displayed expiry."}
        </span>
        <a href="#payment-history">View payment history</a>
      </footer>
    </Card>
  );
}
