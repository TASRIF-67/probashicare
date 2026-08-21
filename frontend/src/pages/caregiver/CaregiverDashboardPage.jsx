import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../components/Card.jsx";
import { CaregiverChecklist } from "../../components/CaregiverChecklist.jsx";
import { CaregiverHeader } from "../../components/caregiver/CaregiverHeader.jsx";
import { DashboardWeekStrip } from "../../components/dashboard/DashboardWeekStrip.jsx";
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  BriefcaseIcon,
  CalendarIcon,
  ClipboardListIcon,
  ClockIcon,
  PencilIcon,
} from "../../components/Icons.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { normalizeApiError } from "../../services/api.js";
import { bookingService } from "../../services/bookingService.js";
import { wellnessReportService } from "../../services/wellnessReportService.js";

const CURRENT_BOOKING_STATUSES = ["pending", "accepted", "confirmed"];
const ASSIGNED_BOOKING_STATUSES = ["accepted", "confirmed"];

/**
 * Formats a booking date without shifting its stored UTC calendar day.
 * @param {string|Date} value - Stored booking date.
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
 * Counts bookings in one workflow status.
 * @param {object[]} bookings - Caregiver booking records.
 * @param {string} status - Status to count.
 * @returns {number} Number of matching bookings.
 * @sideEffects None.
 */
function countBookingsByStatus(bookings, status) {
  let count = 0;

  for (const booking of bookings) {
    if (booking.status === status) {
      count += 1;
    }
  }

  return count;
}

/**
 * Returns the caregiver's active booking records.
 * @param {object[]} bookings - All caregiver bookings.
 * @returns {object[]} Pending, accepted, and confirmed bookings.
 * @sideEffects None.
 */
function getCurrentBookings(bookings) {
  const currentBookings = [];

  for (const booking of bookings) {
    if (CURRENT_BOOKING_STATUSES.includes(booking.status)) {
      currentBookings.push(booking);
    }
  }

  return currentBookings;
}

/**
 * Finds the earliest upcoming occurrence from accepted caregiver bookings.
 * @param {object[]} bookings - All caregiver bookings.
 * @returns {{booking: object, occurrence: object}|null} Next visit and its booking, or null.
 * @sideEffects Reads the current time.
 */
function findNextVisit(bookings) {
  const now = new Date();
  let nextVisit = null;

  for (const booking of bookings) {
    if (!ASSIGNED_BOOKING_STATUSES.includes(booking.status)) {
      continue;
    }

    for (const occurrence of booking.occurrences || []) {
      const occurrenceDate = new Date(occurrence.date);

      if (occurrenceDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
        continue;
      }

      if (!nextVisit || occurrenceDate < new Date(nextVisit.occurrence.date)) {
        nextVisit = {
          booking,
          occurrence,
        };
      }
    }
  }

  return nextVisit;
}

/**
 * Renders the operational home screen for an approved caregiver.
 * @returns {import("react").ReactElement} Next visit, workload, reports, and quick actions.
 * @sideEffects Loads caregiver bookings and report totals from protected APIs.
 */
export function CaregiverDashboardPage() {
  const { user } = useAuth();
  const [state, setState] = useState({
    loading: true,
    bookings: [],
    draftReports: 0,
    totalReports: 0,
    error: "",
  });
  const [selectedProfileId, setSelectedProfileId] = useState("");

  useEffect(() => {
    let isActive = true;

    /**
     * Loads bookings and report totals used by the caregiver dashboard.
     * @returns {Promise<void>}
     * @sideEffects Reads protected APIs and updates dashboard state.
     */
    async function loadDashboard() {
      try {
        const results = await Promise.all([
          bookingService.listCaregiverBookings(),
          wellnessReportService.listMyReports({ page: 1, limit: 1 }),
          wellnessReportService.listMyReports({ status: "draft", page: 1, limit: 1 }),
        ]);

        if (isActive) {
          setState({
            loading: false,
            bookings: results[0].bookings,
            totalReports: results[1].pagination.total,
            draftReports: results[2].pagination.total,
            error: "",
          });
        }
      } catch (requestError) {
        const normalizedError = normalizeApiError(requestError);

        if (isActive) {
          setState({
            loading: false,
            bookings: [],
            totalReports: 0,
            draftReports: 0,
            error: normalizedError.message,
          });
        }
      }
    }

    loadDashboard();

    return function stopDashboardLoad() {
      isActive = false;
    };
  }, []);

  const currentBookings = getCurrentBookings(state.bookings);
  const pendingCount = countBookingsByStatus(state.bookings, "pending");
  const acceptedCount = countBookingsByStatus(state.bookings, "accepted")
    + countBookingsByStatus(state.bookings, "confirmed");
  const completedCount = countBookingsByStatus(state.bookings, "completed");
  const nextVisit = findNextVisit(state.bookings);
  const assignedProfileOptions = [];

  for (const booking of state.bookings) {
    if (!ASSIGNED_BOOKING_STATUSES.includes(booking.status)) {
      continue;
    }

    const profileId = booking.elderlyProfileId?.toString?.() || booking.elderlyProfile?._id;
    const profileName = booking.elderlyProfile?.name || "Care recipient";

    if (!profileId || assignedProfileOptions.some((option) => option.id === profileId)) {
      continue;
    }

    assignedProfileOptions.push({ id: profileId, name: profileName });
  }

  const effectiveProfileId = assignedProfileOptions.some((option) => option.id === selectedProfileId)
    ? selectedProfileId
    : assignedProfileOptions[0]?.id || "";

  const selectedProfileName = assignedProfileOptions.find((option) => option.id === effectiveProfileId)?.name || "Care recipient";

  useEffect(() => {
    if (effectiveProfileId && selectedProfileId !== effectiveProfileId) {
      setSelectedProfileId(effectiveProfileId);
    }
  }, [effectiveProfileId, selectedProfileId]);

  const visibleBookings = [];

  for (let index = 0; index < currentBookings.length && index < 3; index += 1) {
    visibleBookings.push(currentBookings[index]);
  }

  return (
    <main>
      <CaregiverHeader />
      <div className="caregiver-page caregiver-dashboard-page">
        <section className="caregiver-dashboard-hero">
          <div className="caregiver-dashboard-hero__identity">
            <span className="status-orb status-orb--approved">
              <BadgeCheckIcon />
            </span>
            <div>
              <span className="eyebrow">Verified caregiver workspace</span>
              <h1>Welcome back, {user.name}.</h1>
              <p>See what needs attention and record care updates from one place.</p>
            </div>
          </div>
          <div className="caregiver-dashboard-hero__actions">
            <Link className="button button--primary" to="/caregiver/wellness-reports/new">
              <ClipboardListIcon size={17} />
              Create wellness report
            </Link>
            <Link className="button button--secondary" to="/caregiver/bookings">
              Review bookings
            </Link>
          </div>
        </section>

        {state.loading && (
          <div className="page-loader-inline">
            <span className="spinner" />
            Loading caregiver workspace
          </div>
        )}
        {state.error && <div className="alert alert--error">{state.error}</div>}

        {!state.loading && pendingCount > 0 && (
          <Link className="caregiver-attention-banner" to="/caregiver/bookings">
            <span><ClockIcon /></span>
            <div>
              <strong>{pendingCount} booking request{pendingCount === 1 ? "" : "s"} awaiting your response</strong>
              <small>Accept or decline promptly so the family can plan care.</small>
            </div>
            <ArrowRightIcon />
          </Link>
        )}

        <section className="caregiver-booking-summary" aria-label="Caregiver workload summary">
          <Card className="caregiver-summary-card caregiver-summary-card--attention">
            <CalendarIcon />
            <strong>{pendingCount}</strong>
            <span>Pending requests</span>
            <Link className="caregiver-summary-card__link" to="/caregiver/bookings">
              Review requests
            </Link>
          </Card>
          <Card className="caregiver-summary-card">
            <ClockIcon />
            <strong>{acceptedCount}</strong>
            <span>Assigned schedules</span>
            <Link className="caregiver-summary-card__link" to="/caregiver/bookings">
              View schedule
            </Link>
          </Card>
          <Card className="caregiver-summary-card">
            <ClipboardListIcon />
            <strong>{state.draftReports}</strong>
            <span>Report drafts</span>
            <Link className="caregiver-summary-card__link" to="/caregiver/wellness-reports">
              Continue reports
            </Link>
          </Card>
          <Card className="caregiver-summary-card">
            <BadgeCheckIcon />
            <strong>{completedCount}</strong>
            <span>Completed bookings</span>
            <Link className="caregiver-summary-card__link" to="/caregiver/bookings">
              Open history
            </Link>
          </Card>
        </section>

        <DashboardWeekStrip
          bookings={state.bookings}
          schedulePath="/caregiver/bookings"
          title="View schedule"
        />

        <div className="caregiver-operations-grid">
          <Card className="caregiver-next-visit-card">
            <div className="caregiver-card-heading">
              <div>
                <span className="eyebrow">Coming up</span>
                <h2>Next assigned visit</h2>
              </div>
              <CalendarIcon />
            </div>
            {nextVisit ? (
              <div className="caregiver-next-visit">
                <strong>{nextVisit.booking.elderlyProfile?.name || "Care recipient"}</strong>
                <span>{nextVisit.booking.serviceType}</span>
                <div>
                  <span><CalendarIcon size={16} /> {displayDate(nextVisit.occurrence.date)}</span>
                  <span><ClockIcon size={16} /> {nextVisit.occurrence.timeSlot}</span>
                </div>
                <Link className="button button--secondary" to="/caregiver/bookings">
                  View schedule
                  <ArrowRightIcon size={16} />
                </Link>
              </div>
            ) : (
              <div className="caregiver-card-empty">
                <CalendarIcon />
                <strong>No assigned visit ahead</strong>
                <span>Accepted care schedules will appear here.</span>
              </div>
            )}
          </Card>

          <Card className="current-bookings-card">
            <div className="caregiver-card-heading">
              <div>
                <span className="eyebrow">Work queue</span>
                <h2>Current bookings</h2>
              </div>
              <span>{currentBookings.length}</span>
            </div>
            {!currentBookings.length ? (
              <div className="caregiver-card-empty">
                <BriefcaseIcon />
                <strong>Your queue is clear</strong>
                <span>No pending or assigned bookings right now.</span>
              </div>
            ) : (
              <div className="current-booking-list">
                {visibleBookings.map((booking) => (
                  <Link className="current-booking-row" to="/caregiver/bookings" key={booking._id}>
                    <div>
                      <strong>{booking.elderlyProfile?.name || "Care recipient"}</strong>
                      <span>{booking.serviceType}</span>
                      <small><CalendarIcon size={14} /> {displayDate(booking.startDate)}</small>
                    </div>
                    <span className={"status-badge status-badge--" + booking.status}>
                      {booking.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
            <Link className="caregiver-card-link" to="/caregiver/bookings">
              View all bookings
              <ArrowRightIcon size={16} />
            </Link>
          </Card>
        </div>

        <section className="caregiver-dashboard-tools" aria-label="Caregiver tools">
          <Card>
            <span className="feature-icon"><ClipboardListIcon /></span>
            <div>
              <h2>Wellness reporting</h2>
              <p>{state.totalReports} total report{state.totalReports === 1 ? "" : "s"}, with {state.draftReports} draft{state.draftReports === 1 ? "" : "s"} to continue.</p>
            </div>
            <Link className="button button--secondary" to="/caregiver/wellness-reports">
              Open reports
            </Link>
          </Card>
          <Card>
            <span className="feature-icon"><BriefcaseIcon /></span>
            <div>
              <h2>Professional profile</h2>
              <p>Keep your services, rates, area, and weekly availability current.</p>
            </div>
            <Link className="button button--secondary" to="/caregiver/profile">
              <PencilIcon size={17} />
              Manage profile
            </Link>
          </Card>
        </section>
      </div>
    </main>
  );
}
