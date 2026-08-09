import { useEffect, useState } from "react";
import { CaregiverHeader } from "../../components/caregiver/CaregiverHeader.jsx";
import { Button } from "../../components/Button.jsx";
import { Card } from "../../components/Card.jsx";
import { CalendarIcon, CheckIcon, ClockIcon } from "../../components/Icons.jsx";
import { bookingService } from "../../services/bookingService.js";
import { normalizeApiError } from "../../services/api.js";
import { useToast } from "../../context/ToastContext.jsx";

const displayDate = (value) => new Date(value).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" });

export function CaregiverBookingsPage() {
  const { showToast } = useToast();
  const [state, setState] = useState({ loading: true, bookings: [], error: "", busyId: "" });
  const [reasons, setReasons] = useState({});
  const load = () => bookingService.listCaregiverBookings().then(({ bookings }) => setState({ loading: false, bookings, error: "", busyId: "" })).catch((error) => setState((current) => ({ ...current, loading: false, error: normalizeApiError(error).message, busyId: "" })));
  useEffect(() => {
    let active = true;
    bookingService.listCaregiverBookings()
      .then(({ bookings }) => {
        if (active) setState({ loading: false, bookings, error: "", busyId: "" });
      })
      .catch((error) => {
        if (active) setState((current) => ({ ...current, loading: false, error: normalizeApiError(error).message, busyId: "" }));
      });
    return () => { active = false; };
  }, []);
  async function review(booking, status) {
    setState((current) => ({ ...current, busyId: booking._id, error: "" }));
    try { await bookingService.reviewBooking(booking._id, status, reasons[booking._id] || ""); showToast(`Booking ${status}.`, "success"); await load(); } catch (error) { setState((current) => ({ ...current, busyId: "", error: normalizeApiError(error).message })); }
  }
  return <main><CaregiverHeader /><div className="caregiver-page"><div className="page-heading"><span className="eyebrow">Care requests</span><h1>Bookings</h1><p>Review pending requests and track your assigned schedules.</p></div>{state.loading && <div className="page-loader-inline"><span className="spinner" /> Loading requests</div>}{state.error && <div className="alert alert--error">{state.error}</div>}
    {!state.loading && !state.bookings.length && <Card className="empty-state"><CalendarIcon /><h2>No booking requests</h2><p>New family requests will appear here.</p></Card>}
    <div className="booking-list">{state.bookings.map((booking) => <Card className="booking-record" key={booking._id}><div className="booking-record__heading"><div><span className="eyebrow">{booking.bookingType}</span><h2>{booking.elderlyProfile?.name || "Care recipient"}</h2><p>Requested by {booking.familyMember?.name || "family"} - {booking.serviceType}</p></div><span className={`status-badge status-badge--${booking.status}`}>{booking.status}</span></div><div className="booking-record__meta"><span><CalendarIcon size={16} /> {displayDate(booking.startDate)} - {displayDate(booking.endDate)}</span><span><ClockIcon size={16} /> {booking.occurrences?.length || 0} scheduled visit{booking.occurrences?.length === 1 ? "" : "s"}</span></div>{booking.statusReason && <p className="booking-record__reason">{booking.statusReason}</p>}{booking.status === "pending" && <div className="booking-review-actions"><input className="input" value={reasons[booking._id] || ""} disabled={Boolean(state.busyId)} onChange={(event) => setReasons((current) => ({ ...current, [booking._id]: event.target.value }))} placeholder="Reason required when declining" /><Button isLoading={state.busyId === booking._id} disabled={Boolean(state.busyId)} onClick={() => review(booking, "accepted")}><CheckIcon size={16} /> Accept</Button><Button variant="secondary" disabled={Boolean(state.busyId) || !(reasons[booking._id] || "").trim()} onClick={() => review(booking, "declined")}>Decline</Button></div>}{["accepted", "confirmed"].includes(booking.status) && <div className="booking-review-actions"><Button isLoading={state.busyId === booking._id} disabled={Boolean(state.busyId)} onClick={() => review(booking, "completed")}><CheckIcon size={16} /> Mark completed</Button></div>}</Card>)}</div>
  </div></main>;
}
