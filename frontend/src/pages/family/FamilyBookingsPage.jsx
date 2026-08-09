import { useEffect, useState } from "react";
import { AppHeader } from "../../components/AppHeader.jsx";
import { Button } from "../../components/Button.jsx";
import { Card } from "../../components/Card.jsx";
import { CalendarIcon, ClockIcon } from "../../components/Icons.jsx";
import { bookingService } from "../../services/bookingService.js";
import { normalizeApiError } from "../../services/api.js";
import { useToast } from "../../context/ToastContext.jsx";

const date = (value) => new Date(value).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" });

export function FamilyBookingsPage() {
  const { showToast } = useToast();
  const [state, setState] = useState({ loading: true, bookings: [], error: "", busyId: "" });
  const load = () => bookingService.listMyBookings().then(({ bookings }) => setState({ loading: false, bookings, error: "", busyId: "" })).catch((error) => setState((current) => ({ ...current, loading: false, error: normalizeApiError(error).message, busyId: "" })));
  useEffect(() => {
    let active = true;
    bookingService.listMyBookings()
      .then(({ bookings }) => {
        if (active) setState({ loading: false, bookings, error: "", busyId: "" });
      })
      .catch((error) => {
        if (active) setState((current) => ({ ...current, loading: false, error: normalizeApiError(error).message, busyId: "" }));
      });
    return () => { active = false; };
  }, []);
  async function cancel(booking) {
    if (!window.confirm("Cancel this booking request?")) return;
    setState((current) => ({ ...current, busyId: booking._id }));
    try { await bookingService.cancelBooking(booking._id); showToast("Booking cancelled.", "success"); await load(); } catch (error) { setState((current) => ({ ...current, busyId: "", error: normalizeApiError(error).message })); }
  }
  return <main><AppHeader /><div className="feature-page"><div className="page-heading"><span className="eyebrow">Care coordination</span><h1>Booking history</h1><p>Track caregiver requests and cancel active schedules when plans change.</p></div>
    {state.loading && <div className="page-loader-inline"><span className="spinner" /> Loading bookings</div>}{state.error && <div className="alert alert--error">{state.error}</div>}
    {!state.loading && !state.bookings.length && <Card className="empty-state"><CalendarIcon /><h2>No bookings yet</h2><p>Your caregiver requests will appear here.</p></Card>}
    <div className="booking-list">{state.bookings.map((booking) => <Card className="booking-record" key={booking._id}><div className="booking-record__heading"><div><span className="eyebrow">{booking.bookingType}</span><h2>{booking.caregiver?.name || "Caregiver"}</h2><p>Care for {booking.elderlyProfile?.name || "elderly profile"} - {booking.serviceType}</p></div><span className={`status-badge status-badge--${booking.status}`}>{booking.status}</span></div><div className="booking-record__meta"><span><CalendarIcon size={16} /> {date(booking.startDate)} - {date(booking.endDate)}</span><span><ClockIcon size={16} /> {booking.occurrences?.length || 0} visit{booking.occurrences?.length === 1 ? "" : "s"}</span></div>{booking.statusReason && <p className="booking-record__reason">{booking.statusReason}</p>}{["pending", "accepted", "confirmed"].includes(booking.status) && <Button variant="secondary" isLoading={state.busyId === booking._id} disabled={Boolean(state.busyId)} onClick={() => cancel(booking)}>Cancel booking</Button>}</Card>)}</div>
  </div></main>;
}
