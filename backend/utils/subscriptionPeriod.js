/**
 * Returns the final valid day for a UTC calendar month.
 * @param {number} year - Four-digit UTC year.
 * @param {number} monthIndex - Zero-based UTC month.
 * @returns {number} Last valid day from 28 through 31.
 * @sideEffects None.
 */
function getDaysInUtcMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
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
  const start = new Date(startingValue);

  if (Number.isNaN(start.getTime())) {
    throw new TypeError("A valid subscription period start is required.");
  }

  if (!Number.isInteger(monthCount) || monthCount < 1) {
    throw new RangeError("Calendar month duration must be a positive whole number.");
  }

  const originalDay = start.getUTCDate();
  const targetMonthValue = start.getUTCMonth() + monthCount;
  const targetYear =
    start.getUTCFullYear() + Math.floor(targetMonthValue / 12);
  const targetMonth = targetMonthValue % 12;
  const targetDay = Math.min(
    originalDay,
    getDaysInUtcMonth(targetYear, targetMonth),
  );

  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      targetDay,
      start.getUTCHours(),
      start.getUTCMinutes(),
      start.getUTCSeconds(),
      start.getUTCMilliseconds(),
    ),
  );
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
    throw new RangeError("Subscription duration must be a positive whole number.");
  }

  if (durationType === "hours") {
    return new Date(start.getTime() + durationValue * 60 * 60 * 1000);
  }

  if (durationType === "months") {
    return addCalendarMonths(start, durationValue);
  }

  if (durationType === "years") {
    return addCalendarMonths(start, durationValue * 12);
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
    const expiry = new Date(currentExpiryValue);

    if (
      !Number.isNaN(expiry.getTime()) &&
      expiry.getTime() > completedAt.getTime()
    ) {
      return expiry;
    }
  }

  return completedAt;
}
