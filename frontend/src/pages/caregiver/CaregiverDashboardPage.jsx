import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../components/Card.jsx";
import { CaregiverHeader } from "../../components/caregiver/CaregiverHeader.jsx";
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

const CURRENT_BOOKING_STATUSES = ["pending", "accepted", "confirmed"];

/**
 * Formats a booking date without shifting its stored UTC calendar day.
 * @param {string|Date} value - Stored booking date.
 * @returns {string} Localized medium-length date.
 * @sideEffects None.
 */
function displayDate(value) {
  const options = {
    dateStyle: "medium",
    timeZone: "UTC",
  };

  return new Date(value).toLocaleDateString(undefined, options);
}

/**
 * Counts bookings in one status.
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
 * Renders an operational overview for an approved caregiver.
 * @param {void} _unused - This page accepts no props.
 * @returns {import("react").ReactElement} Booking summary, current schedule, and quick actions.
 * @sideEffects Loads caregiver bookings from the API.
 */
export function CaregiverDashboardPage() {
  const { user } = useAuth();
  const [state, setState] = useState({
    loading: true,
    bookings: [],
    error: "",
  });

  useEffect(() => {
    let isActive = true;

    /**
     * Loads all caregiver bookings used by the dashboard summary.
     * @returns {Promise<void>}
     * @sideEffects Reads the booking API and updates dashboard state.
     */
    async function loadBookings() {
      try {
        const data = await bookingService.listCaregiverBookings();

        if (isActive) {
          setState({
            loading: false,
            bookings: data.bookings,
            error: "",
          });
        }
      } catch (error) {
        const normalizedError = normalizeApiError(error);

        if (isActive) {
          setState({
            loading: false,
            bookings: [],
            error: normalizedError.message,
          });
        }
      }
    }

    loadBookings();

    return () => {
      isActive = false;
    };
  }, []);

  const currentBookings = [];

  for (const booking of state.bookings) {
    if (CURRENT_BOOKING_STATUSES.includes(booking.status)) {
      currentBookings.push(booking);
    }
  }

  const pendingCount = countBookingsByStatus(state.bookings, "pending");
  const acceptedCount =
    countBookingsByStatus(state.bookings, "accepted") +
    countBookingsByStatus(state.bookings, "confirmed");
  const completedCount = countBookingsByStatus(state.bookings, "completed");

  return (
    <main>
      <CaregiverHeader />
      <div className="caregiver-page">
        <div className="approved-hero">
          <span className="status-orb status-orb--approved">
            <BadgeCheckIcon />
          </span>
          <div>
            <span className="eyebrow">Verified caregiver</span>
            <h1>Welcome, {user.name}.</h1>
            <p>
              Review care requests, manage assigned visits, and share wellness
              updates with families.
            </p>
          </div>
        </div>

        <section
          className="caregiver-booking-summary"
          aria-label="Booking summary"
        >
          <Card className="caregiver-summary-card">
            <CalendarIcon />
            <strong>{pendingCount}</strong>
            <span>Pending requests</span>
          </Card>
          <Card className="caregiver-summary-card">
            <ClockIcon />
            <strong>{acceptedCount}</strong>
            <span>Assigned bookings</span>
          </Card>
          <Card className="caregiver-summary-card">
            <BadgeCheckIcon />
            <strong>{completedCount}</strong>
            <span>Completed bookings</span>
          </Card>
        </section>

        <div className="caregiver-dashboard-grid">
          <Card className="current-bookings-card">
            <div className="current-bookings-card__heading">
              <span className="feature-icon">
                <CalendarIcon />
              </span>
              <div>
                <h2>Current bookings</h2>
                <p>Pending requests and assigned care schedules.</p>
              </div>
            </div>

            {state.loading && (
              <div className="page-loader-inline">
                <span className="spinner" />
                Loading bookings
              </div>
            )}

            {state.error && (
              <div className="alert alert--error">
                {state.error}
              </div>
            )}

            {!state.loading && !currentBookings.length && (
              <p>No pending or assigned bookings right now.</p>
            )}

            <div className="current-booking-list">
              {currentBookings.map((booking) => (
                <Link
                  className="current-booking-row"
                  to="/caregiver/bookings"
                  key={booking._id}
                >
                  <div>
                    <strong>
                      {booking.elderlyProfile
                        ? booking.elderlyProfile.name
                        : "Care recipient"}
                    </strong>
                    <span>{booking.serviceType}</span>
                    <small>
                      <CalendarIcon size={14} />
                      {displayDate(booking.startDate)}
                    </small>
                  </div>
                  <span
                    className={
                      "status-badge status-badge--" + booking.status
                    }
                  >
                    {booking.status}
                  </span>
                </Link>
              ))}
            </div>

            <Link
              className="button button--secondary"
              to="/caregiver/bookings"
            >
              View all bookings
              <ArrowRightIcon size={17} />
            </Link>
          </Card>

          <div className="caregiver-dashboard-actions">
            <Card>
              <span className="feature-icon">
                <ClipboardListIcon />
              </span>
              <h2>Wellness reports</h2>
              <p>
                Record mood, meals, medicine intake, vitals, and visit
                observations for assigned care recipients.
              </p>
              <Link
                className="button button--primary"
                to="/caregiver/wellness-reports/new"
              >
                Create report
              </Link>
            </Card>

            <Card>
              <span className="feature-icon">
                <BriefcaseIcon />
              </span>
              <h2>Your professional profile</h2>
              <p>
                Keep your bio, skills, rates, service area, and availability
                current.
              </p>
              <Link
                className="button button--secondary"
                to="/caregiver/profile"
              >
                <PencilIcon size={17} />
                Manage profile
              </Link>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
