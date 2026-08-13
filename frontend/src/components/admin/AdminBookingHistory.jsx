import { useEffect, useState } from "react";
import { CalendarIcon, ClockIcon, UsersIcon } from "../Icons.jsx";
import { Pagination } from "../Pagination.jsx";
import { adminService } from "../../services/adminService.js";
import { normalizeApiError } from "../../services/api.js";

const STATUS_OPTIONS = [
  {
    value: "all",
    label: "All statuses",
  },
  {
    value: "pending",
    label: "Pending",
  },
  {
    value: "accepted",
    label: "Accepted",
  },
  {
    value: "confirmed",
    label: "Confirmed",
  },
  {
    value: "completed",
    label: "Completed",
  },
  {
    value: "cancelled",
    label: "Cancelled",
  },
  {
    value: "declined",
    label: "Declined",
  },
];

/**
 * Formats an admin booking date without shifting its calendar day.
 * @param {string|Date} value - Stored booking date.
 * @returns {string} Human-readable UTC date.
 * @sideEffects None.
 */
function formatDate(value) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

/**
 * Displays read-only family-to-caregiver booking history for administrators.
 * @returns {import("react").ReactElement} Booking metrics, filters, records, and pagination.
 * @sideEffects Loads protected admin booking pages when filters change.
 */
export function AdminBookingHistory() {
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [state, setState] = useState({
    loading: true,
    bookings: [],
    summary: null,
    pagination: {
      page: 1,
      pages: 0,
      total: 0,
    },
    error: "",
  });

  useEffect(() => {
    let active = true;

    /**
     * Loads one filtered page of the platform booking audit history.
     * @returns {Promise<void>}
     * @sideEffects Calls the admin API and updates component state.
     */
    async function loadBookingHistory() {
      setState(function markHistoryLoading(current) {
        return {
          ...current,
          loading: true,
          error: "",
        };
      });

      try {
        const result = await adminService.listBookings({
          status,
          page,
          limit: 3,
        });

        if (active) {
          setState({
            loading: false,
            bookings: result.bookings,
            summary: result.summary,
            pagination: result.pagination,
            error: "",
          });
        }
      } catch (requestError) {
        if (active) {
          setState(function showHistoryError(current) {
            return {
              ...current,
              loading: false,
              error: normalizeApiError(requestError).message,
            };
          });
        }
      }
    }

    loadBookingHistory();

    return function stopHistoryLoad() {
      active = false;
    };
  }, [status, page]);

  /**
   * Applies a status filter and returns to the first result page.
   * @param {import("react").ChangeEvent<HTMLSelectElement>} event - Status selector change.
   * @returns {void}
   * @sideEffects Updates status and page state.
   */
  function changeStatus(event) {
    setStatus(event.target.value);
    setPage(1);
  }

  const summary = state.summary || {
    all: 0,
    pending: 0,
    accepted: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    declined: 0,
  };
  const activeBookings = summary.accepted + summary.confirmed;
  const closedBookings = summary.cancelled + summary.declined;

  return (
    <section className="admin-booking-history" aria-labelledby="admin-booking-history-title">
      <div className="admin-booking-history__heading">
        <div>
          <span className="eyebrow">Care operations</span>
          <h2 id="admin-booking-history-title">Family-to-caregiver bookings</h2>
          <p>
            Read-only history of every care request and its current workflow status.
          </p>
        </div>
        <label className="field admin-booking-history__filter">
          <span>Filter status</span>
          <select
            className="input"
            value={status}
            disabled={state.loading}
            onChange={changeStatus}
          >
            {STATUS_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="admin-booking-metrics" aria-label="Booking status summary">
        <div><span>All bookings</span><strong>{summary.all}</strong></div>
        <div><span>Pending review</span><strong>{summary.pending}</strong></div>
        <div><span>Active care</span><strong>{activeBookings}</strong></div>
        <div><span>Completed</span><strong>{summary.completed}</strong></div>
        <div><span>Closed</span><strong>{closedBookings}</strong></div>
      </div>

      {state.error && <div className="alert alert--error">{state.error}</div>}
      {state.loading && (
        <div className="page-loader-inline">
          <span className="spinner" />
          Loading booking history
        </div>
      )}

      {!state.loading && !state.error && state.bookings.length === 0 && (
        <div className="admin-booking-history__empty">
          <CalendarIcon />
          <strong>No matching bookings</strong>
          <span>Try another status filter.</span>
        </div>
      )}

      <div className="admin-booking-table" aria-live="polite">
        {state.bookings.map((booking) => (
          <article className={"admin-booking-row admin-booking-row--" + booking.status} key={booking.id}>
            <div className="admin-booking-row__route">
              <span className="admin-booking-row__icon"><UsersIcon size={19} /></span>
              <div>
                <strong>{booking.family?.name || "Unknown family"}</strong>
                <span>booked</span>
                <strong>{booking.caregiver?.name || "Unknown caregiver"}</strong>
              </div>
            </div>
            <div className="admin-booking-row__care">
              <strong>{booking.elderlyProfile?.name || "Legacy care recipient"}</strong>
              <span>{booking.serviceType} · {booking.bookingType}</span>
            </div>
            <div className="admin-booking-row__schedule">
              <span><CalendarIcon size={15} /> {formatDate(booking.startDate)} - {formatDate(booking.endDate)}</span>
              <span><ClockIcon size={15} /> {booking.occurrences.length} scheduled visit{booking.occurrences.length === 1 ? "" : "s"}</span>
            </div>
            <div className="admin-booking-row__status">
              <span className={"status-badge status-badge--" + booking.status}>
                {booking.status}
              </span>
              <small>Requested {formatDate(booking.createdAt)}</small>
            </div>
            {booking.statusReason && (
              <div className="admin-booking-row__reason">
                <strong>Status note:</strong> {booking.statusReason}
              </div>
            )}
          </article>
        ))}
      </div>

      <Pagination
        page={state.pagination.page}
        pages={state.pagination.pages}
        total={state.pagination.total}
        label="bookings"
        disabled={state.loading}
        onPageChange={setPage}
      />
    </section>
  );
}
