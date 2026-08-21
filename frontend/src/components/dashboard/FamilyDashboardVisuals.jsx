import { Link } from "react-router-dom";
import { Card } from "../Card.jsx";
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  CalendarIcon,
  ClockIcon,
  UsersIcon,
} from "../Icons.jsx";

const ASSIGNED_STATUSES = ["accepted", "confirmed"];

/**
 * Formats a stored booking date without shifting its UTC calendar day.
 * @param {string|Date|null|undefined} value - Stored booking or occurrence date.
 * @returns {string} Compact local date label or Date unavailable.
 * @sideEffects None.
 */
function formatVisitDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

/**
 * Formats a booking update timestamp for the recent-activity timeline.
 * @param {string|Date|null|undefined} value - Booking update or creation time.
 * @returns {string} Readable date and time, or Time unavailable.
 * @sideEffects None.
 */
function formatActivityTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Time unavailable";
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Creates a short two-letter avatar label from a person's name.
 * @param {string} name - Caregiver name.
 * @returns {string} One or two uppercase initials.
 * @sideEffects None.
 */
function getInitials(name) {
  const words = name.trim().split(/\s+/);
  let initials = "";

  for (const word of words) {
    if (word && initials.length < 2) {
      initials += word[0].toUpperCase();
    }
  }

  return initials || "CG";
}

/**
 * Collects unique caregivers assigned through accepted family bookings.
 * @param {object[]} bookings - Loaded family bookings.
 * @returns {object[]} Up to four unique caregiver records.
 * @sideEffects None.
 */
function collectAssignedCaregivers(bookings) {
  const caregivers = [];
  const caregiverIds = {};

  for (const booking of bookings) {
    if (!ASSIGNED_STATUSES.includes(booking.status)) {
      continue;
    }

    const caregiver = booking.caregiver;
    const caregiverId = caregiver?._id || caregiver?.id || caregiver?.name;

    if (!caregiverId || caregiverIds[caregiverId]) {
      continue;
    }

    caregiverIds[caregiverId] = true;
    caregivers.push(caregiver);

    if (caregivers.length === 4) {
      break;
    }
  }

  return caregivers;
}

/**
 * Collects and orders the nearest accepted care occurrences.
 * @param {object[]} bookings - Loaded family bookings.
 * @param {number} limit - Maximum visits to return.
 * @returns {{booking: object, occurrence: object}[]} Upcoming care visits.
 * @sideEffects Reads the current local date.
 */
function collectUpcomingVisits(bookings, limit) {
  const visits = [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const booking of bookings) {
    if (!ASSIGNED_STATUSES.includes(booking.status)) {
      continue;
    }

    for (const occurrence of booking.occurrences || []) {
      const occurrenceDate = new Date(occurrence.date);

      if (Number.isNaN(occurrenceDate.getTime()) || occurrenceDate < today) {
        continue;
      }

      visits.push({
        booking,
        occurrence,
      });
    }
  }

  // Sorting a small copied visit list keeps the nearest dates at the top.
  visits.sort((firstVisit, secondVisit) => {
    return new Date(firstVisit.occurrence.date) - new Date(secondVisit.occurrence.date);
  });

  return visits.slice(0, limit);
}

/**
 * Returns clear activity copy for a booking workflow status.
 * @param {object} booking - Family booking record.
 * @returns {{title: string, description: string}} Timeline title and detail.
 * @sideEffects None.
 */
function describeBookingActivity(booking) {
  const caregiverName = booking.caregiver?.name || "Caregiver";
  const profileName = booking.elderlyProfile?.name || "care recipient";

  if (booking.status === "completed") {
    return {
      title: "Care visit completed",
      description: `${caregiverName} completed care for ${profileName}`,
    };
  }

  if (booking.status === "pending") {
    return {
      title: "Caregiver response pending",
      description: `${caregiverName} received a request for ${profileName}`,
    };
  }

  if (ASSIGNED_STATUSES.includes(booking.status)) {
    return {
      title: "Care visit scheduled",
      description: `${caregiverName} is assigned to ${profileName}`,
    };
  }

  if (booking.status === "cancelled") {
    return {
      title: "Booking cancelled",
      description: `The care booking with ${caregiverName} was cancelled`,
    };
  }

  if (booking.status === "declined") {
    return {
      title: "Care request declined",
      description: `${caregiverName} could not accept the request`,
    };
  }

  return {
    title: "Booking updated",
    description: `The care booking for ${profileName} changed status`,
  };
}

/**
 * Selects a visual icon for a booking activity status.
 * @param {{status: string}} props - Booking status used for icon selection.
 * @returns {import("react").ReactElement} Decorative status icon.
 * @sideEffects None.
 */
function BookingActivityIcon({ status }) {
  if (status === "completed") {
    return <BadgeCheckIcon aria-hidden="true" />;
  }

  if (status === "pending") {
    return <ClockIcon aria-hidden="true" />;
  }

  if (ASSIGNED_STATUSES.includes(status)) {
    return <CalendarIcon aria-hidden="true" />;
  }

  return <UsersIcon aria-hidden="true" />;
}

/**
 * Displays assigned caregivers and the next two accepted care visits.
 * @param {object} props - Care-team panel properties.
 * @param {object[]} props.bookings - Loaded family bookings.
 * @param {string} props.profileName - Primary care-recipient name.
 * @returns {import("react").ReactElement} Care-team and upcoming-visit card.
 * @sideEffects None.
 */
export function FamilyCareTeamCard({ bookings, profileName }) {
  const caregivers = collectAssignedCaregivers(bookings);
  const upcomingVisits = collectUpcomingVisits(bookings, 2);

  return (
    <Card className="family-care-team-card">
      <div className="family-visual-card__heading">
        <div>
          <span className="eyebrow">Care team</span>
          <h2>Assigned to {profileName}</h2>
        </div>
        <span>{caregivers.length}</span>
      </div>

      {caregivers.length > 0 ? (
        <div className="family-care-team-card__people">
          <div className="family-care-team-card__avatars" aria-hidden="true">
            {caregivers.map((caregiver) => (
              <span key={caregiver._id || caregiver.name}>
                {getInitials(caregiver.name || "Caregiver")}
              </span>
            ))}
          </div>
          <div>
            {caregivers.map((caregiver, index) => (
              <span key={caregiver._id || caregiver.name}>
                <strong>{caregiver.name || "Caregiver"}</strong>
                {index === 0 ? "Primary caregiver" : "Assigned caregiver"}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="family-visual-card__empty">
          No caregiver is assigned yet.
        </div>
      )}

      <div className="family-care-team-card__schedule">
        <span className="eyebrow">Next scheduled visit</span>
        {upcomingVisits.length === 0 && (
          <div className="family-visual-card__empty">
            Accepted visits will appear here.
          </div>
        )}
        {upcomingVisits.map((visit, index) => (
          <Link
            className={index === 0 ? "family-care-visit family-care-visit--next" : "family-care-visit"}
            to="/bookings"
            key={`${visit.booking._id}-${visit.occurrence.date}-${visit.occurrence.timeSlot}`}
          >
            <span className="family-care-visit__date">
              {formatVisitDate(visit.occurrence.date)}
            </span>
            <span>
              <strong>{visit.booking.caregiver?.name || "Caregiver"}</strong>
              <small>{visit.booking.serviceType}</small>
            </span>
            <time>{visit.occurrence.timeSlot}</time>
            <ArrowRightIcon size={15} aria-hidden="true" />
          </Link>
        ))}
      </div>

      <Link className="family-dashboard-card-link" to="/bookings">
        View full calendar
        <ArrowRightIcon size={15} aria-hidden="true" />
      </Link>
    </Card>
  );
}

/**
 * Displays recent family booking workflow changes as a vertical timeline.
 * @param {{bookings: object[]}} props - Loaded family booking records.
 * @returns {import("react").ReactElement} Recent booking-activity card.
 * @sideEffects None.
 */
export function FamilyRecentActivityCard({ bookings }) {
  const visibleBookings = [];

  for (let index = 0; index < bookings.length && index < 4; index += 1) {
    visibleBookings.push(bookings[index]);
  }

  return (
    <Card className="family-recent-activity-card">
      <div className="family-visual-card__heading">
        <div>
          <span className="eyebrow">Live status</span>
          <h2>Recent booking activity</h2>
        </div>
      </div>

      {visibleBookings.length === 0 ? (
        <div className="family-visual-card__empty">
          Booking updates will appear here.
        </div>
      ) : (
        <div className="family-activity-timeline">
          {visibleBookings.map((booking) => {
            const activity = describeBookingActivity(booking);

            return (
              <Link to="/bookings" key={booking._id}>
                <span className="family-activity-timeline__icon">
                  <BookingActivityIcon status={booking.status} />
                </span>
                <span>
                  <strong>{activity.title}</strong>
                  <small>{activity.description}</small>
                  <time>
                    {formatActivityTime(
                      booking.updatedAt || booking.createdAt || booking.startDate,
                    )}
                  </time>
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <Link className="family-dashboard-card-link" to="/bookings">
        Open booking history
        <ArrowRightIcon size={15} aria-hidden="true" />
      </Link>
    </Card>
  );
}
