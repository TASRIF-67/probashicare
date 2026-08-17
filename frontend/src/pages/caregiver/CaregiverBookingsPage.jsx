import { useEffect, useState } from "react";
import { CaregiverHeader } from "../../components/caregiver/CaregiverHeader.jsx";
import { Button } from "../../components/Button.jsx";
import { Card } from "../../components/Card.jsx";
import {
  BadgeCheckIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  SearchIcon,
} from "../../components/Icons.jsx";
import { Pagination } from "../../components/Pagination.jsx";
import { bookingService } from "../../services/bookingService.js";
import { normalizeApiError } from "../../services/api.js";
import { useToast } from "../../context/ToastContext.jsx";

const RECORDS_PER_PAGE = 3;
const ASSIGNED_STATUSES = ["accepted", "confirmed"];
const HISTORY_STATUSES = ["completed", "cancelled", "declined"];
const BOOKING_VIEWS = [
  {
    value: "pending",
    label: "Needs response",
  },
  {
    value: "assigned",
    label: "Assigned care",
  },
  {
    value: "history",
    label: "History",
  },
  {
    value: "all",
    label: "All bookings",
  },
];

/**
 * Formats a stored date without shifting its UTC calendar day.
 * @param {string|Date} value - Stored booking or occurrence date.
 * @returns {string} Localized medium-length date.
 * @sideEffects None.
 */
function displayDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    dateStyle: "medium",
    timeZone: "UTC",
  });
}

/**
 * Counts bookings that match a supplied list of statuses.
 * @param {object[]} bookings - Caregiver booking records.
 * @param {string[]} statuses - Status values included in the count.
 * @returns {number} Number of matching bookings.
 * @sideEffects None.
 */
function countByStatuses(bookings, statuses) {
  let count = 0;

  for (const booking of bookings) {
    if (statuses.includes(booking.status)) {
      count += 1;
    }
  }

  return count;
}

/**
 * Determines whether a booking belongs in a selected work-queue view.
 * @param {object} booking - Booking being tested.
 * @param {string} view - Selected view name.
 * @returns {boolean} True when the booking should be displayed.
 * @sideEffects None.
 */
function bookingMatchesView(booking, view) {
  if (view === "all") {
    return true;
  }

  if (view === "pending") {
    return booking.status === "pending";
  }

  if (view === "assigned") {
    return ASSIGNED_STATUSES.includes(booking.status);
  }

  return HISTORY_STATUSES.includes(booking.status);
}

/**
 * Filters caregiver bookings by workflow view and visible names.
 * @param {object[]} bookings - All caregiver booking records.
 * @param {string} view - Selected work-queue view.
 * @param {string} search - Recipient, family, or service search text.
 * @returns {object[]} Matching booking records.
 * @sideEffects None.
 */
function filterBookings(bookings, view, search) {
  const filteredBookings = [];
  const normalizedSearch = search.trim().toLowerCase();

  for (const booking of bookings) {
    if (!bookingMatchesView(booking, view)) {
      continue;
    }

    if (normalizedSearch) {
      const recipientName = booking.elderlyProfile?.name || "";
      const familyName = booking.familyMember?.name || "";
      const searchableText = (
        recipientName
        + " "
        + familyName
        + " "
        + booking.serviceType
      ).toLowerCase();

      if (!searchableText.includes(normalizedSearch)) {
        continue;
      }
    }

    filteredBookings.push(booking);
  }

  return filteredBookings;
}

/**
 * Returns a readable empty-state title for the active view.
 * @param {string} view - Selected booking view.
 * @param {string} search - Current search text.
 * @returns {string} Empty-state heading.
 * @sideEffects None.
 */
function getEmptyTitle(view, search) {
  if (search.trim()) {
    return "No matching bookings";
  }

  if (view === "pending") {
    return "No requests need a response";
  }

  if (view === "assigned") {
    return "No assigned care schedules";
  }

  if (view === "history") {
    return "No booking history yet";
  }

  return "No booking requests";
}

/**
 * Displays the caregiver's filterable booking work queue and status actions.
 * @returns {import("react").ReactElement} Modern booking management page.
 * @sideEffects Loads bookings and may accept, decline, or complete a booking.
 */
export function CaregiverBookingsPage() {
  const { showToast } = useToast();
  const [state, setState] = useState({
    loading: true,
    bookings: [],
    error: "",
    busyId: "",
  });
  const [selectedView, setSelectedView] = useState("pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reasons, setReasons] = useState({});

  /**
   * Reloads all bookings after a caregiver status change.
   * @returns {Promise<void>}
   * @sideEffects Calls the caregiver booking API and replaces page state.
   */
  async function loadBookings() {
    try {
      const result = await bookingService.listCaregiverBookings();
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
          busyId: "",
          error: normalizeApiError(requestError).message,
        };
      });
    }
  }

  useEffect(() => {
    let active = true;

    /**
     * Loads the initial caregiver booking queue safely.
     * @returns {Promise<void>}
     * @sideEffects Updates page state while the component remains mounted.
     */
    async function loadInitialBookings() {
      try {
        const result = await bookingService.listCaregiverBookings();

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
   * Sends one permitted caregiver booking transition to the API.
   * @param {object} booking - Booking being reviewed.
   * @param {"accepted"|"declined"|"completed"} status - Requested next status.
   * @returns {Promise<void>}
   * @sideEffects Updates the booking, shows a toast, and reloads the queue.
   */
  async function reviewBooking(booking, status) {
    if (status === "completed") {
      const confirmed = window.confirm(
        "Mark this complete care schedule as finished? During development, early completion may be enabled for testing.",
      );

      if (!confirmed) {
        return;
      }
    }

    setState(function markBookingBusy(current) {
      return {
        ...current,
        busyId: booking._id,
        error: "",
      };
    });

    try {
      await bookingService.reviewBooking(
        booking._id,
        status,
        reasons[booking._id] || "",
      );
      showToast("Booking " + status + ".", "success");
      setPage(1);
      setReasons(function clearUsedReason(current) {
        return {
          ...current,
          [booking._id]: "",
        };
      });
      await loadBookings();
    } catch (requestError) {
      setState(function showReviewError(current) {
        return {
          ...current,
          busyId: "",
          error: normalizeApiError(requestError).message,
        };
      });
    }
  }

  /**
   * Changes the visible work queue and returns to its first page.
   * @param {string} view - New booking view.
   * @returns {void}
   * @sideEffects Updates filter and pagination state.
   */
  function changeView(view) {
    setSelectedView(view);
    setPage(1);
  }

  /**
   * Updates the booking search and returns to the first page.
   * @param {import("react").ChangeEvent<HTMLInputElement>} event - Search input event.
   * @returns {void}
   * @sideEffects Updates search and pagination state.
   */
  function changeSearch(event) {
    setSearch(event.target.value);
    setPage(1);
  }

  /**
   * Updates the decline reason for one pending booking.
   * @param {string} bookingId - Booking identifier.
   * @param {string} reason - Current decline explanation.
   * @returns {void}
   * @sideEffects Updates the reason collection in component state.
   */
  function changeReason(bookingId, reason) {
    setReasons(function updateReason(current) {
      return {
        ...current,
        [bookingId]: reason,
      };
    });
  }

  const pendingCount = countByStatuses(state.bookings, ["pending"]);
  const assignedCount = countByStatuses(state.bookings, ASSIGNED_STATUSES);
  const completedCount = countByStatuses(state.bookings, ["completed"]);
  const closedCount = countByStatuses(state.bookings, ["cancelled", "declined"]);
  const filteredBookings = filterBookings(state.bookings, selectedView, search);
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
      <CaregiverHeader />
      <div className="caregiver-page caregiver-bookings-page">
        <section className="caregiver-bookings-hero">
          <div>
            <span className="eyebrow">Care operations</span>
            <h1>Booking workspace</h1>
            <p>Respond to family requests, review visit dates, and manage assigned care.</p>
          </div>
          <div className="caregiver-bookings-hero__status">
            <span><ClockIcon size={17} /> Needs response</span>
            <strong>{pendingCount}</strong>
          </div>
        </section>

        <section className="caregiver-booking-summary" aria-label="Booking status summary">
          <Card className="caregiver-summary-card caregiver-summary-card--attention">
            <ClockIcon />
            <strong>{pendingCount}</strong>
            <span>Needs response</span>
          </Card>
          <Card className="caregiver-summary-card">
            <CalendarIcon />
            <strong>{assignedCount}</strong>
            <span>Assigned schedules</span>
          </Card>
          <Card className="caregiver-summary-card">
            <BadgeCheckIcon />
            <strong>{completedCount}</strong>
            <span>Completed</span>
          </Card>
          <Card className="caregiver-summary-card">
            <CheckIcon />
            <strong>{closedCount}</strong>
            <span>Cancelled or declined</span>
          </Card>
        </section>

        <div className="caregiver-booking-toolbar">
          <nav className="booking-view-tabs" aria-label="Filter caregiver bookings">
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
                <span>{filterBookings(state.bookings, view.value, "").length}</span>
              </button>
            ))}
          </nav>
          <label className="caregiver-booking-search">
            <SearchIcon size={17} />
            <span className="sr-only">Search bookings</span>
            <input
              type="search"
              value={search}
              placeholder="Search recipient, family, or service"
              onChange={changeSearch}
            />
          </label>
        </div>

        {state.loading && (
          <div className="page-loader-inline">
            <span className="spinner" />
            Loading requests
          </div>
        )}
        {state.error && <div className="alert alert--error">{state.error}</div>}

        {!state.loading && filteredBookings.length === 0 && (
          <Card className="empty-state caregiver-booking-empty">
            <CalendarIcon />
            <h2>{getEmptyTitle(selectedView, search)}</h2>
            <p>Booking records matching this view will appear here.</p>
          </Card>
        )}

        <div className="caregiver-booking-list">
          {visibleBookings.map((booking) => {
            const displayedOccurrences = (booking.occurrences || []).slice(0, 3);
            const remainingOccurrences = (booking.occurrences?.length || 0) - displayedOccurrences.length;
            const declineReason = reasons[booking._id] || "";

            return (
              <Card
                className={"caregiver-booking-card caregiver-booking-card--" + booking.status}
                key={booking._id}
              >
                <div className="caregiver-booking-card__main">
                  <div className="caregiver-booking-card__identity">
                    <span className="profile-avatar">
                      {(booking.elderlyProfile?.name || "C")[0]}
                    </span>
                    <div>
                      <span className="eyebrow">{booking.bookingType} · {booking.serviceType}</span>
                      <h2>{booking.elderlyProfile?.name || "Care recipient"}</h2>
                      <p>Requested by {booking.familyMember?.name || "Family member"}</p>
                    </div>
                  </div>
                  <span className={"status-badge status-badge--" + booking.status}>
                    {booking.status}
                  </span>
                </div>

                <div className="caregiver-booking-card__overview">
                  <span><CalendarIcon size={16} /> {displayDate(booking.startDate)} - {displayDate(booking.endDate)}</span>
                  <span><ClockIcon size={16} /> {booking.occurrences?.length || 0} scheduled visit{booking.occurrences?.length === 1 ? "" : "s"}</span>
                </div>

                <section className="caregiver-booking-card__schedule" aria-label="Scheduled visit dates">
                  <strong>Visit schedule</strong>
                  <div>
                    {displayedOccurrences.map((occurrence) => (
                      <span key={occurrence.date + occurrence.timeSlot}>
                        <CalendarIcon size={14} />
                        {displayDate(occurrence.date)}
                        <small>{occurrence.timeSlot}</small>
                      </span>
                    ))}
                    {remainingOccurrences > 0 && (
                      <span className="caregiver-booking-card__more">
                        +{remainingOccurrences} more visit{remainingOccurrences === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </section>

                {booking.statusReason && (
                  <div className="booking-record__reason-box">
                    <strong>Status note</strong>
                    <p>{booking.statusReason}</p>
                  </div>
                )}

                {booking.status === "pending" && (
                  <div className="caregiver-booking-decision">
                    <div>
                      <strong>Respond to this request</strong>
                      <p>Accept the full schedule, or explain why you need to decline it.</p>
                    </div>
                    <label className="field">
                      <span>Decline reason</span>
                      <input
                        className="input"
                        value={declineReason}
                        disabled={Boolean(state.busyId)}
                        maxLength={500}
                        placeholder="Required only when declining"
                        onChange={(event) => changeReason(booking._id, event.target.value)}
                      />
                    </label>
                    <div className="caregiver-booking-decision__actions">
                      <Button
                        isLoading={state.busyId === booking._id}
                        disabled={Boolean(state.busyId)}
                        onClick={() => reviewBooking(booking, "accepted")}
                      >
                        <CheckIcon size={16} />
                        Accept schedule
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={Boolean(state.busyId) || !declineReason.trim()}
                        onClick={() => reviewBooking(booking, "declined")}
                      >
                        Decline request
                      </Button>
                    </div>
                  </div>
                )}

                {ASSIGNED_STATUSES.includes(booking.status) && (
                  <div className="caregiver-booking-complete">
                    <div>
                      <strong>Assigned care</strong>
                      <span>
                        Complete the full schedule after its final visit. A
                        development setting may allow early testing.
                      </span>
                    </div>
                    <Button
                      isLoading={state.busyId === booking._id}
                      disabled={Boolean(state.busyId)}
                      onClick={() => reviewBooking(booking, "completed")}
                    >
                      <CheckIcon size={16} />
                      Mark completed
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
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
