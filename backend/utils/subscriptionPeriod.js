const HOURS_TO_MILLISECONDS = 60 * 60 * 1000;
const MONTHS_IN_YEAR = 12;

/**
 * Returns the final valid day for a UTC calendar month.
 * @param {number} year - Four-digit UTC year.
 * @param {number} monthIndex - Zero-based UTC month.
 * @returns {number} Last valid day from 28 through 31.
 * @sideEffects None.
 */
function getDaysInUtcMonth(year, monthIndex) {
  // Day zero of the next month means the final day of the requested month.
  const finalDay = new Date(Date.UTC(year, monthIndex + 1, 0));

  return finalDay.getUTCDate();
}

/**
 * Adds calendar months while safely clamping month-end dates.
 * @param {Date|string|number} startingValue - Valid date-like period start.
 * @param {number} monthCount - Positive whole number of months.
 * @returns {Date} New UTC date; the input is not modified.
 * @sideEffects None.
 * @throws {TypeError|RangeError} When an input is invalid.
 */
export function addCalendarMonths(startingValue, monthCount) {
  // `new Date` creates a separate Date object, so the caller's Date is not
  // changed by later calculations.
  const start = new Date(startingValue);

  // An invalid Date returns NaN from `getTime`.
  if (Number.isNaN(start.getTime())) {
    throw new TypeError("A valid subscription period start is required.");
  }

  // `Number.isInteger` rejects decimals, strings, NaN, and infinity.
  if (!Number.isInteger(monthCount) || monthCount < 1) {
    throw new RangeError(
      "Calendar month duration must be a positive whole number.",
    );
  }

  const originalDay = start.getUTCDate();
  const targetMonthValue = start.getUTCMonth() + monthCount;

  // `Math.floor` calculates how many complete years the month total crosses.
  const additionalYears = Math.floor(targetMonthValue / MONTHS_IN_YEAR);
  const targetYear = start.getUTCFullYear() + additionalYears;

  // Remainder (%) converts an absolute month total back to zero through eleven.
  const targetMonth = targetMonthValue % MONTHS_IN_YEAR;

  // `Math.min` clamps January 31 to February 28/29 rather than overflowing.
  const targetDay = Math.min(
    originalDay,
    getDaysInUtcMonth(targetYear, targetMonth),
  );

  const utcTimestamp = Date.UTC(
    targetYear,
    targetMonth,
    targetDay,
    start.getUTCHours(),
    start.getUTCMinutes(),
    start.getUTCSeconds(),
    start.getUTCMilliseconds(),
  );

  return new Date(utcTimestamp);
}

/**
 * Adds a backend-controlled plan duration to a starting date.
 * @param {Date|string|number} startingValue - Valid date-like period start.
 * @param {"hours"|"months"|"years"} durationType - Plan duration unit.
 * @param {number} durationValue - Positive whole plan duration.
 * @returns {Date} Calculated subscription period end.
 * @sideEffects None.
 * @throws {TypeError|RangeError} When an input is invalid or unsupported.
 */
export function calculateSubscriptionPeriodEnd(
  startingValue,
  durationType,
  durationValue,
) {
  const start = new Date(startingValue);

  if (Number.isNaN(start.getTime())) {
    throw new TypeError("A valid subscription period start is required.");
  }

  if (!Number.isInteger(durationValue) || durationValue < 1) {
    throw new RangeError(
      "Subscription duration must be a positive whole number.",
    );
  }

  if (durationType === "hours") {
    const durationMilliseconds = durationValue * HOURS_TO_MILLISECONDS;

    return new Date(start.getTime() + durationMilliseconds);
  }

  if (durationType === "months") {
    return addCalendarMonths(start, durationValue);
  }

  if (durationType === "years") {
    const durationMonths = durationValue * MONTHS_IN_YEAR;

    return addCalendarMonths(start, durationMonths);
  }

  throw new RangeError("Unsupported subscription duration type.");
}

/**
 * Selects the start for an early or expired renewal.
 * @param {Date|string|number} completedAtValue - Successful payment time.
 * @param {Date|string|number|null} currentExpiryValue - Existing expiry.
 * @returns {Date} Future expiry for early renewal, otherwise payment time.
 * @sideEffects None.
 * @throws {TypeError} When payment completion is invalid.
 */
export function selectRenewalStart(completedAtValue, currentExpiryValue) {
  const completedAt = new Date(completedAtValue);

  if (Number.isNaN(completedAt.getTime())) {
    throw new TypeError("A valid payment completion time is required.");
  }

  if (currentExpiryValue) {
    const currentExpiry = new Date(currentExpiryValue);
    const expiryIsValid = !Number.isNaN(currentExpiry.getTime());
    const expiryIsInFuture =
      expiryIsValid && currentExpiry.getTime() > completedAt.getTime();

    if (expiryIsInFuture) {
      // Early renewal starts at the old expiry, so paid time is not lost.
      return currentExpiry;
    }
  }

  // Expired/new access begins when the payment completed.
  return completedAt;
}
