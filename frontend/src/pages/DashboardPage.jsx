import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "../components/AppHeader.jsx";
import { Card } from "../components/Card.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { ArrowRightIcon, CalendarIcon, ClockIcon, UsersIcon } from "../components/Icons.jsx";
import { bookingService } from "../services/bookingService.js";
import { normalizeApiError } from "../services/api.js";

const ACTIVE_STATUSES = new Set(["pending", "accepted", "confirmed"]);
const displayDate = (value) => new Date(value).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" });

/**
 * Renders the protected family dashboard placeholder.
 * @param {void} _unused - This page accepts no props.
 * @returns {import("react").ReactElement} Family-only dashboard shell.
 * @sideEffects Navigates to linked profile management when selected.
 */
export function DashboardPage() {
  const { user } = useAuth();
  const [bookingState, setBookingState] = useState({ loading: true, bookings: [], error: "" });

  useEffect(() => {
    let active = true;
    bookingService.listMyBookings().then(({ bookings }) => {
      if (active) setBookingState({ loading: false, bookings: bookings.filter((booking) => ACTIVE_STATUSES.has(booking.status)), error: "" });
    }).catch((error) => {
      if (active) setBookingState({ loading: false, bookings: [], error: normalizeApiError(error).message });
    });
    return () => { active = false; };
  }, []);

  return <main><AppHeader /><div className="simple-page"><span className="eyebrow">Family dashboard</span><h1>Good to see you, {user.name}.</h1>
    <div className="dashboard-card-grid"><Card><span className="feature-icon"><UsersIcon /></span><h2>Family health profiles</h2><p>Review personal information, medical history, allergies, medications, chronic diseases, and emergency contacts.</p><Link className="button button--primary" to="/elderly-profiles">View elderly profiles <ArrowRightIcon size={18} /></Link></Card>
      <Card className="current-bookings-card"><div className="current-bookings-card__heading"><span className="feature-icon"><CalendarIcon /></span><div><h2>Current bookings</h2><p>See the latest caregiver response and care schedule.</p></div></div>
        {bookingState.loading && <div className="page-loader-inline"><span className="spinner" /> Loading booking status</div>}
        {bookingState.error && <div className="alert alert--error">{bookingState.error}</div>}
        {!bookingState.loading && !bookingState.error && !bookingState.bookings.length && <div className="empty-state"><p>You have no active caregiver bookings.</p><Link to="/caregivers">Find a caregiver</Link></div>}
        <div className="current-booking-list">{bookingState.bookings.slice(0, 3).map((booking) => <Link to="/bookings" className="current-booking-row" key={booking._id}><div><strong>{booking.caregiver?.name || "Caregiver"}</strong><span>Care for {booking.elderlyProfile?.name || "your relative"}</span><small><ClockIcon size={14} /> {displayDate(booking.startDate)} · {booking.occurrences?.length || 0} visit{booking.occurrences?.length === 1 ? "" : "s"}</small></div><span className={`status-badge status-badge--${booking.status}`}>{booking.status}</span></Link>)}</div>
        <Link className="button button--secondary" to="/bookings">View all bookings <ArrowRightIcon size={18} /></Link>
      </Card></div>
  </div></main>;
}
