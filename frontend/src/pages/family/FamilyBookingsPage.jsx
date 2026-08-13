import { useEffect, useState } from "react";
import { AppHeader } from "../../components/AppHeader.jsx";
import { Button } from "../../components/Button.jsx";
import { Card } from "../../components/Card.jsx";
import { CalendarIcon, ClockIcon } from "../../components/Icons.jsx";
import { Pagination } from "../../components/Pagination.jsx";
import { bookingService } from "../../services/bookingService.js";
import { normalizeApiError } from "../../services/api.js";
import { useToast } from "../../context/ToastContext.jsx";

const RECORDS_PER_PAGE = 3;
const CURRENT_STATUSES = ["pending", "accepted", "confirmed"];
const CLOSED_STATUSES = ["cancelled", "declined"];

const BOOKING_VIEWS = [
  {
    value: "current",
    label: "Current",
  },
  {
    value: "completed",
    label: "Completed",
  },
  {
    value: "closed",
    label: "Cancelled & declined",
  },
  {
    value: "all",
    label: "All bookings",
  },
];

/**
 * Formats a stored booking date for the family booking history.
 * @param {string|Date} value - Stored booking date.
 * @returns {string} Date formatted for the user's language.
 * @sideEffects None.
 */
function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    dateStyle: "medium",
    timeZone: "UTC",
  });
}

/**
 * Returns bookings that belong in the selected family history view.
 * @param {Array<object>} bookings - All family bookings returned by the API.
 * @param {string} view - Selected booking view.
 * @returns {Array<object>} Bookings matching the selected view.
 * @sideEffects None.
 */
function filterBookings(bookings, view) {
  const filteredBookings = [];

  for (const booking of bookings) {
    let shouldInclude = false;

    if (view === "all") {
      shouldInclude = true;
    } else if (view === "current") {
      shouldInclude = CURRENT_STATUSES.includes(booking.status);
    } else if (view === "completed") {
      shouldInclude = booking.status === "completed";
    } else if (view === "closed") {
      shouldInclude = CLOSED_STATUSES.includes(booking.status);
    }

    if (shouldInclude) {
      filteredBookings.push(booking);
    }
  }

  return filteredBookings;
}

/**
 * Counts booking records for the family overview cards.
 * @param {Array<object>} bookings - All family bookings.
 * @returns {{current: number, pending: number, completed: number, closed: number}} Status-group totals.
 * @sideEffects None.
 */
function countBookings(bookings) {
  const counts = {
    current: 0,
    pending: 0,
    completed: 0,
    closed: 0,
  };

  for (const booking of bookings) {
    if (CURRENT_STATUSES.includes(booking.status)) {
      counts.current += 1;
    }

    if (booking.status === "pending") {
      counts.pending += 1;
    }

    if (booking.status === "completed") {
      counts.completed += 1;
    }

    if (CLOSED_STATUSES.includes(booking.status)) {
      counts.closed += 1;
    }
  }

  return counts;
}

/**
 * Returns the heading used when a booking view contains no records.
 * @param {string} view - Selected booking view.
 * @returns {string} Empty-state heading.
 * @sideEffects None.
 */
function getEmptyHeading(view) {
  if (view === "current") {
    return "No current bookings";
  }

  if (view === "completed") {
    return "No completed bookings";
  }

  if (view === "closed") {
    return "No cancelled or declined bookings";
  }

  return "No bookings yet";
}

/**
 * Returns supporting text for an empty booking view.
 * @param {string} view - Selected booking view.
 * @returns {string} Empty-state description.
 * @sideEffects None.
 */
function getEmptyMessage(view) {
  if (view === "current") {
    return "New pending or accepted caregiver schedules will appear here.";
  }

  if (view === "completed") {
    return "Care visits will move here after the caregiver completes them.";
  }

  if (view === "closed") {
    return "Cancelled and declined requests are kept here for your records.";
  }

  return "Your caregiver requests will appear here.";
}

/**
 * Displays and manages the family account's complete caregiver booking history.
 * @returns {import("react").ReactElement} Filtered and paginated booking page.
 * @sideEffects Loads bookings and may cancel an active booking.
 */
export function FamilyBookingsPage() {
  const { showToast } = useToast();
  const [state, setState] = useState({
    loading: true,
    bookings: [],
    error: "",
    busyId: "",
  });
  const [selectedView, setSelectedView] = useState("current");
  const [page, setPage] = useState(1);

  /**
   * Loads the latest family bookings from the API.
   * @returns {Promise<void>}
   * @sideEffects Replaces booking page state.
   */
  async function loadBookings() {
    try {
      const result = await bookingService.listMyBookings();
      setState({
        loading: false,
        bookings: result.bookings,
        error: "",
        busyId: "",
      });
    } catch (requestError) {
      setState(function showLoadError(current) {
        return {
          ...current,
          loading: false,
          error: normalizeApiError(requestError).message,
          busyId: "",
        };
      });
    }
  }

  useEffect(() => {
    let active = true;

    /**
     * Loads bookings safely for the page's initial render.
     * @returns {Promise<void>}
     * @sideEffects Updates page state while the component remains mounted.
     */
    async function loadInitialBookings() {
      try {
        const result = await bookingService.listMyBookings();

        if (active) {
          setState({
            loading: false,
            bookings: result.bookings,
            error: "",
            busyId: "",
          });
        }
      } catch (requestError) {
        if (active) {
          setState(function showInitialError(current) {
            return {
              ...current,
              loading: false,
              error: normalizeApiError(requestError).message,
              busyId: "",
            };
          });
        }
      }
    }

    loadInitialBookings();

    return function stopInitialLoad() {
      active = false;
    };
  }, []);

  /**
   * Cancels an active booking after the family confirms the action.
   * @param {object} booking - Booking selected for cancellation.
   * @returns {Promise<void>}
   * @sideEffects Shows browser confirmation, calls the API, and refreshes data.
   */
  async function cancelBooking(booking) {
    const confirmed = window.confirm(
      "Cancel this booking? It will remain in Cancelled & declined for your records.",
    );

    if (!confirmed) {
      return;
    }

    setState(function markBookingBusy(current) {
      return {
        ...current,
        busyId: booking._id,
        error: "",
      };
    });

    try {
      await bookingService.cancelBooking(booking._id);
      showToast("Booking cancelled and moved to your history.", "success");
      setPage(1);
      await loadBookings();
    } catch (requestError) {
      setState(function showCancellationError(current) {
        return {
          ...current,
          busyId: "",
          error: normalizeApiError(requestError).message,
        };
      });
    }
  }

  /**
   * Changes the visible booking group and returns pagination to page one.
   * @param {string} view - New booking view.
   * @returns {void}
   * @sideEffects Updates filter and pagination state.
   */
  function changeView(view) {
    setSelectedView(view);
    setPage(1);
  }

  const counts = countBookings(state.bookings);
  const filteredBookings = filterBookings(state.bookings, selectedView);
  const totalPages = Math.ceil(filteredBookings.length / RECORDS_PER_PAGE);
  const firstRecordIndex = (page - 1) * RECORDS_PER_PAGE;
  const visibleBookings = [];

  for (
    let index = firstRecordIndex;
    index < firstRecordIndex + RECORDS_PER_PAGE
      && index < filteredBookings.length;
    index += 1
  ) {
    visibleBookings.push(filteredBookings[index]);
  }

  return (
    <main>
      <AppHeader />
      <div className="feature-page family-bookings-page">
        <div className="page-heading">
          <span className="eyebrow">Care coordination</span>
          <h1>Your caregiver bookings</h1>
          <p>
            Review active care schedules separately from completed,
            cancelled, and declined booking history.
          </p>
        </div>

        <section className="booking-summary-grid" aria-label="Booking overview">
          <div className="booking-summary-card booking-summary-card--current">
            <span>Current care</span>
            <strong>{counts.current}</strong>
            <small>Pending or accepted schedules</small>
          </div>
          <div className="booking-summary-card">
            <span>Awaiting response</span>
            <strong>{counts.pending}</strong>
            <small>Requests caregivers need to review</small>
          </div>
          <div className="booking-summary-card">
            <span>Completed</span>
            <strong>{counts.completed}</strong>
            <small>Finished care schedules</small>
          </div>
          <div className="booking-summary-card booking-summary-card--closed">
            <span>Closed</span>
            <strong>{counts.closed}</strong>
            <small>Cancelled or declined requests</small>
          </div>
        </section>

        <nav className="booking-view-tabs" aria-label="Filter family bookings">
          {BOOKING_VIEWS.map((view) => (
            <button
              type="button"
              className={selectedView === view.value
                ? "booking-view-tab booking-view-tab--active"
                : "booking-view-tab"}
              aria-pressed={selectedView === view.value}
              key={view.value}
              onClick={() => changeView(view.value)}
            >
              {view.label}
              <span>{filterBookings(state.bookings, view.value).length}</span>
            </button>
          ))}
        </nav>

        {state.loading && (
          <div className="page-loader-inline">
            <span className="spinner" />
            Loading bookings
          </div>
        )}
        {state.error && <div className="alert alert--error">{state.error}</div>}

        {!state.loading && filteredBookings.length === 0 && (
          <Card className="empty-state booking-history-empty">
            <CalendarIcon />
            <h2>{getEmptyHeading(selectedView)}</h2>
            <p>{getEmptyMessage(selectedView)}</p>
          </Card>
        )}

        <div className="booking-list">
          {visibleBookings.map((booking) => (
            <Card
              className={"booking-record booking-record--" + booking.status}
              key={booking._id}
            >
              <div className="booking-record__heading">
                <div>
                  <span className="eyebrow">{booking.bookingType}</span>
                  <h2>{booking.caregiver?.name || "Caregiver"}</h2>
                  <p>
                    Care for {booking.elderlyProfile?.name || "elderly profile"}
                    {" · " + booking.serviceType}
                  </p>
                </div>
                <span className={"status-badge status-badge--" + booking.status}>
                  {booking.status}
                </span>
              </div>
              <div className="booking-record__meta">
                <span>
                  <CalendarIcon size={16} />
                  {formatDate(booking.startDate)} - {formatDate(booking.endDate)}
                </span>
                <span>
                  <ClockIcon size={16} />
                  {booking.occurrences?.length || 0} visit
                  {booking.occurrences?.length === 1 ? "" : "s"}
                </span>
              </div>
              {booking.statusReason && (
                <div className="booking-record__reason-box">
                  <strong>Status note</strong>
                  <p>{booking.statusReason}</p>
                </div>
              )}
              {CURRENT_STATUSES.includes(booking.status) && (
                <div className="booking-record__actions">
                  <span>
                    Cancelling keeps this record in your booking history.
                  </span>
                  <Button
                    variant="secondary"
                    isLoading={state.busyId === booking._id}
                    disabled={Boolean(state.busyId)}
                    onClick={() => cancelBooking(booking)}
                  >
                    Cancel booking
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>

        <Pagination
          page={page}
          pages={totalPages}
          total={filteredBookings.length}
          label="bookings"
          disabled={state.loading}
          onPageChange={setPage}
        />
      </div>
    </main>
  );
}
