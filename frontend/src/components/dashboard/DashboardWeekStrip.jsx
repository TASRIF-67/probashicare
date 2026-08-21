import { Link } from "react-router-dom";
import { ArrowRightIcon, CalendarIcon } from "../Icons.jsx";

const EXCLUDED_BOOKING_STATUSES = ["cancelled", "declined"];

/**
 * Converts a booking or occurrence date into a stable calendar-day key.
 * @param {string|Date|null|undefined} value - Stored date value.
 * @returns {string} Calendar key in YYYY-MM-DD form, or an empty string.
 * @sideEffects None.
 */
function getCalendarKey(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  let month = String(date.getMonth() + 1);
  let day = String(date.getDate());

  if (month.length === 1) {
    month = "0" + month;
  }

  if (day.length === 1) {
    day = "0" + day;
  }

  return `${year}-${month}-${day}`;
}

/**
 * Returns the Monday that begins the supplied date's local calendar week.
 * @param {Date} date - Date inside the requested week.
 * @returns {Date} Local midnight on that week's Monday.
 * @sideEffects None.
 */
function getWeekStart(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = start.getDay();
  let daysSinceMonday = weekday - 1;

  if (weekday === 0) {
    daysSinceMonday = 6;
  }

  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

/**
 * Formats the visible date range for a seven-day dashboard strip.
 * @param {Date} start - Week start date.
 * @param {Date} end - Week end date.
 * @returns {string} Compact range such as Aug 17–23 or Aug 30–Sep 5.
 * @sideEffects None.
 */
function formatWeekRange(start, end) {
  const startMonth = start.toLocaleDateString(undefined, { month: "short" });
  const endMonth = end.toLocaleDateString(undefined, { month: "short" });

  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()}–${end.getDate()}`;
  }

  return `${startMonth} ${start.getDate()}–${endMonth} ${end.getDate()}`;
}

/**
 * Collects visit counts for calendar dates represented by active booking records.
 * @param {object[]} bookings - Family or caregiver booking records.
 * @returns {Record<string, number>} Visit counts indexed by YYYY-MM-DD day keys.
 * @sideEffects None.
 */
function collectVisitCounts(bookings) {
  const visitCounts = {};

  for (const booking of bookings) {
    if (EXCLUDED_BOOKING_STATUSES.includes(booking.status)) {
      continue;
    }

    const occurrences = booking.occurrences || [];

    if (occurrences.length === 0) {
      const bookingDateKey = getCalendarKey(booking.startDate);

      if (bookingDateKey) {
        const currentCount = visitCounts[bookingDateKey] || 0;
        visitCounts[bookingDateKey] = currentCount + 1;
      }

      continue;
    }

    for (const occurrence of occurrences) {
      const occurrenceDateKey = getCalendarKey(occurrence.date);

      if (!occurrenceDateKey) {
        continue;
      }

      const currentCount = visitCounts[occurrenceDateKey] || 0;
      visitCounts[occurrenceDateKey] = currentCount + 1;
    }
  }

  return visitCounts;
}

/**
 * Displays the current week and marks dates containing real booking occurrences.
 * @param {object} props - Weekly calendar properties.
 * @param {object[]} props.bookings - Loaded family or caregiver bookings.
 * @param {string} props.schedulePath - Route used to open the full schedule.
 * @param {string} [props.title] - Visible schedule heading.
 * @returns {import("react").ReactElement} Accessible seven-day booking strip.
 * @sideEffects Reads the current local calendar date.
 */
export function DashboardWeekStrip({
  bookings,
  schedulePath,
  title = "Weekly schedule",
}) {
  const today = new Date();
  const todayKey = getCalendarKey(today);
  const weekStart = getWeekStart(today);
  const weekDays = [];
  const visitCounts = collectVisitCounts(bookings);

  for (let index = 0; index < 7; index += 1) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    weekDays.push(date);
  }

  const weekEnd = weekDays[weekDays.length - 1];

  return (
    <section className="dashboard-week-strip" aria-labelledby="dashboard-week-title">
      <header className="dashboard-week-strip__heading">
        <div>
          <span className="eyebrow">This week</span>
          <h2 id="dashboard-week-title">{formatWeekRange(weekStart, weekEnd)}</h2>
        </div>
        <Link to={schedulePath}>
          <CalendarIcon size={16} aria-hidden="true" />
          {title}
          <ArrowRightIcon size={15} aria-hidden="true" />
        </Link>
      </header>

      <div className="dashboard-week-strip__scroller">
        <div className="dashboard-week-strip__days">
          {weekDays.map((date) => {
            const dateKey = getCalendarKey(date);
            const visitCount = visitCounts[dateKey] || 0;
            const isToday = dateKey === todayKey;
            let dayClassName = "dashboard-week-day";

            if (isToday) {
              dayClassName += " dashboard-week-day--today";
            }

            if (visitCount > 0) {
              dayClassName += " dashboard-week-day--scheduled";
            }

            return (
              <div
                className={dayClassName}
                key={dateKey}
                aria-current={isToday ? "date" : undefined}
                aria-label={`${date.toLocaleDateString()}, ${visitCount} scheduled visit${visitCount === 1 ? "" : "s"}`}
              >
                <span>
                  {date.toLocaleDateString(undefined, { weekday: "short" })}
                </span>
                <strong>{date.getDate()}</strong>
                <i aria-hidden="true" />
                {visitCount > 1 && (
                  <small>{visitCount} visits</small>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
