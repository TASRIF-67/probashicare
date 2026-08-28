import { Card } from "../Card.jsx";
import { CalendarIcon, ClockIcon, ShieldCheckIcon } from "../Icons.jsx";

/**
 * Separates a stored subscription timestamp into readable date and time labels.
 * @param {string|Date|null} value - Stored date value.
 * @returns {{date: string, time: string}} Localized date and time labels.
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

  // `Number.isNaN` checks this exact value without converting other data types.
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
 * Adds the correct singular or plural unit to a number.
 * @param {number} amount - Unit quantity.
 * @param {string} singularUnit - Unit name for exactly one.
 * @returns {string} Quantity followed by the correct unit label.
 * @sideEffects None.
 */
function formatCount(amount, singularUnit) {
  let unit = singularUnit;

  if (amount !== 1) {
    unit += "s";
  }

  return amount + " " + unit;
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

  const expiryMilliseconds = new Date(expiryValue).getTime();
  const millisecondsRemaining = expiryMilliseconds - Date.now();

  if (millisecondsRemaining <= 0) {
    return "Expired";
  }

  // `Math.ceil` keeps any partial minute visible instead of showing zero early.
  const totalMinutes = Math.ceil(millisecondsRemaining / (60 * 1000));
  // `Math.floor` removes the fractional part after division.
  const days = Math.floor(totalMinutes / (24 * 60));
  // The remainder operator (%) keeps only minutes left after complete days.
  const minutesAfterDays = totalMinutes % (24 * 60);
  const hours = Math.floor(minutesAfterDays / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return (
      formatCount(days, "day") +
      ", " +
      formatCount(hours, "hour") +
      " remaining"
    );
  }

  if (hours > 0) {
    return (
      formatCount(hours, "hour") +
      ", " +
      formatCount(minutes, "minute") +
      " remaining"
    );
  }

  return formatCount(minutes, "minute") + " remaining";
}

/**
 * Calculates elapsed-period progress for a visual subscription timeline.
 * @param {string|Date|null} startValue - Period activation time.
 * @param {string|Date|null} endValue - Period expiry time.
 * @returns {number} Whole percentage from zero through one hundred.
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
  // `Math.round` displays a whole percentage to keep the label simple.
  const percentage = Math.round((elapsed / duration) * 100);
  // `Math.max` prevents negative values and `Math.min` caps the result at 100.
  return Math.min(100, Math.max(0, percentage));
}

/**
 * Chooses the plan name shown to the Family account.
 * @param {object|null} subscription - Stored subscription document.
 * @returns {string} Snapshot plan name, trial label, or Core label.
 * @sideEffects None.
 */
function getPlanName(subscription) {
  if (subscription?.planSnapshot?.name) {
    return subscription.planSnapshot.name;
  }

  if (subscription?.status === "trialing") {
    return "Seven-day free trial";
  }

  return "Core family access";
}

/**
 * Chooses the assurance text shown beneath the current period.
 * @param {boolean} isExpired - Whether the exact expiry has passed.
 * @returns {string} Access assurance or renewal instruction.
 * @sideEffects None.
 */
function getAssuranceMessage(isExpired) {
  if (isExpired) {
    return "This access period has ended. Choose a plan to restore Premium access.";
  }

  return "Your current care access continues uninterrupted until the displayed expiry.";
}

/**
 * Presents the Family account's current plan, status, activation, and expiry.
 * @param {{subscription: object|null, access: object|null}} props - Current state.
 * @returns {import("react").ReactElement} Enhanced current-plan summary card.
 * @sideEffects Reads current time for remaining-time and progress presentation.
 */
export function CurrentSubscriptionCard({ subscription, access }) {
  const planName = getPlanName(subscription);
  const startTime =
    subscription?.currentPeriodStartedAt ||
    subscription?.trialStartedAt ||
    null;
  const expiryTime =
    access?.expiresAt || subscription?.currentPeriodEndsAt || null;
  const progress = calculateProgress(startTime, expiryTime);
  const status = access?.status || subscription?.status || "none";
  const accessLevel = access?.accessLevel || "core";
  const startDisplay = formatDateParts(startTime);
  const expiryDisplay = formatDateParts(expiryTime);
  let isExpired = false;

  if (expiryTime) {
    isExpired = new Date(expiryTime).getTime() <= Date.now();
  }

  const assuranceMessage = getAssuranceMessage(isExpired);
  let actionLabel = "Choose a plan";

  if (expiryTime) {
    actionLabel = "Manage plan";
  }

  return (
    <Card className="current-plan-card">
      <header className="current-plan-card__header">
        <div className="current-plan-card__identity">
          <span className="current-plan-card__icon">
            <ShieldCheckIcon />
          </span>
          <div>
            <span className="eyebrow">{accessLevel} access</span>
            <span className="current-plan-card__name-row">
              <h2>{planName}</h2>
              <span className={"status-badge status-badge--" + status}>
                {status}
              </span>
            </span>
          </div>
        </div>
        <a className="current-plan-card__action" href="#plan-options-title">
          {actionLabel}
          <span aria-hidden="true">-&gt;</span>
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
              <span>
                <CalendarIcon size={15} />
                Activated
              </span>
              <strong>{startDisplay.date}</strong>
              <small>{startDisplay.time}</small>
            </div>
            <div>
              <span>
                <ClockIcon size={15} />
                Exact expiry
              </span>
              <strong>{expiryDisplay.date}</strong>
              <small>{expiryDisplay.time}</small>
            </div>
          </div>

          <p className="current-plan-card__renewal-note">
            Manual renewal: Premium access remains available until the exact
            expiry shown above.
          </p>
        </div>
      )}

      {!expiryTime && (
        <p className="current-plan-card__core-note">
          Core access keeps existing care information available without an
          expiry date.
        </p>
      )}

      <footer className="current-plan-card__assurance">
        <span>
          <ShieldCheckIcon size={16} />
          {assuranceMessage}
        </span>
        <a href="#payment-history">View payment history</a>
      </footer>
    </Card>
  );
}
