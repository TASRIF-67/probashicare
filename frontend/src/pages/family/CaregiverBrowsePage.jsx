import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "../../components/AppHeader.jsx";
import { Button } from "../../components/Button.jsx";
import { Card } from "../../components/Card.jsx";
import { Input } from "../../components/Input.jsx";
import { Modal } from "../../components/Modal.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { AlertIcon, CalendarIcon, CheckIcon, ClockIcon, MoneyIcon, SearchIcon, ShieldCheckIcon } from "../../components/Icons.jsx";
import { api, normalizeApiError } from "../../services/api.js";
import { bookingService } from "../../services/bookingService.js";

const BOOKING_TYPES = [
  { value: "one-time", label: "One-time" },
  { value: "scheduled", label: "Scheduled" },
  { value: "long-term", label: "Long-term" },
];

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const SERVICE_TYPES = [
  "companionship",
  "personal-care",
  "medical-support",
  "post-surgery",
  "overnight",
  "rehabilitation",
];

function toDisplayTime(startTime, endTime) {
  return `${startTime} - ${endTime}`;
}

function CaregiverCard({ caregiver, onBook }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="profile-card" style={{ display: "grid" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, gridColumn: "1 / -1" }}>
        <span className="profile-avatar">{caregiver.name?.[0] || "C"}</span>
        <div>
          <span className="profile-card__relation">Verified caregiver</span>
          <h2 style={{ margin: "6px 0 0" }}>{caregiver.name}</h2>
          <p style={{ margin: "4px 0 0" }}>{caregiver.serviceArea || "Local service area"}</p>
        </div>
      </div>
      <div className="profile-card__meta" style={{ gridColumn: "1 / -1" }}>
        {caregiver.supportedServiceTypes?.slice(0, 4).map((service) => (
          <span key={service}>{service}</span>
        ))}
      </div>
      <div style={{ gridColumn: "1 / -1", display: "grid", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, color: "var(--muted)", fontSize: ".85rem" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><ShieldCheckIcon size={16} /> {caregiver.yearsOfExperience ?? 0} yrs experience</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><MoneyIcon size={16} /> {caregiver.hourlyRate ? `$${caregiver.hourlyRate}/hr` : "Rate available on request"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <button type="button" className="button button--secondary" onClick={() => setExpanded((value) => !value)}>
            {expanded ? "Hide schedule" : "View schedule"}
          </button>
          <Button type="button" onClick={() => onBook(caregiver)}>Book now</Button>
        </div>
      </div>
      {expanded && (
        <div style={{ gridColumn: "1 / -1", display: "grid", gap: 8, paddingTop: 8 }}>
          {(caregiver.availability || []).length ? (
            caregiver.availability.map((slot) => (
              <div key={`${slot.day}-${slot.startTime}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, border: "1px solid var(--border)", borderRadius: 12, padding: "10px 12px" }}>
                <span style={{ textTransform: "capitalize", fontWeight: 700 }}>{slot.day}</span>
                <span style={{ color: "var(--muted)" }}>{toDisplayTime(slot.startTime, slot.endTime)}</span>
              </div>
            ))
          ) : (
            <div className="empty-state">No weekly availability uploaded yet.</div>
          )}
        </div>
      )}
    </Card>
  );
}

export function CaregiverBrowsePage() {
  const { showToast } = useToast();
  const [caregivers, setCaregivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    serviceType: "",
    day: "",
    search: "",
  });
  const [selectedCaregiver, setSelectedCaregiver] = useState(null);
  const [bookingForm, setBookingForm] = useState({
    bookingType: "one-time",
    serviceType: "companionship",
    startDate: "",
    endDate: "",
    timeSlot: "",
    day: "",
  });
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableSlots = useMemo(() => {
    if (!selectedCaregiver) return [];
    return (selectedCaregiver.availability || []).filter((slot) => !filters.day || slot.day === filters.day);
  }, [selectedCaregiver, filters.day]);

  function loadCaregivers(nextFilters = filters) {
    setLoading(true);
    api
      .get("/caregivers", { params: { serviceType: nextFilters.serviceType || undefined, day: nextFilters.day || undefined } })
      .then((response) => {
        const list = response.data.data.caregivers || [];
        const query = (nextFilters.search || "").trim().toLowerCase();
        const visible = query
          ? list.filter((caregiver) => `${caregiver.name} ${caregiver.bio} ${caregiver.serviceArea}`.toLowerCase().includes(query))
          : list;
        setCaregivers(visible);
        setError("");
      })
      .catch((error) => setError(normalizeApiError(error).message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadCaregivers();
  }, []);

  function openBookingModal(caregiver) {
    setSelectedCaregiver(caregiver);
    setBookingForm({
      bookingType: "one-time",
      serviceType: caregiver.supportedServiceTypes?.[0] || "companionship",
      startDate: "",
      endDate: "",
      timeSlot: "",
      day: "",
    });
    setFormError("");
  }

  function handleSlotChange(slot) {
    setBookingForm((current) => ({ ...current, timeSlot: `${slot.startTime}-${slot.endTime}`, day: slot.day }));
  }

  async function submitBooking(event) {
    event.preventDefault();
    if (!selectedCaregiver) return;
    setIsSubmitting(true);
    setFormError("");

    try {
      await bookingService.createBooking({
        caregiverId: selectedCaregiver._id,
        bookingType: bookingForm.bookingType,
        serviceType: bookingForm.serviceType,
        startDate: bookingForm.startDate,
        endDate: bookingForm.bookingType === "one-time" ? bookingForm.startDate : bookingForm.endDate,
        timeSlot: bookingForm.timeSlot,
        day: bookingForm.day,
      });
      showToast("Booking request sent successfully.", "success");
      setSelectedCaregiver(null);
      setBookingForm({ bookingType: "one-time", serviceType: "companionship", startDate: "", endDate: "", timeSlot: "", day: "" });
    } catch (requestError) {
      setFormError(normalizeApiError(requestError).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main>
      <AppHeader />
      <div className="feature-page">
        <div className="page-heading page-heading--action">
          <div>
            <span className="eyebrow">Family bookings</span>
            <h1>Find caregivers</h1>
            <p>Browse verified care professionals and request services that fit your schedule.</p>
          </div>
        </div>

        <Card className="form-section" style={{ marginBottom: 24 }}>
          <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <label className="field">
              <span>Search</span>
              <Input
                id="caregiver-search"
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="Name, service, location"
              />
            </label>
            <label className="field">
              <span>Service type</span>
              <select className="input" value={filters.serviceType} onChange={(event) => setFilters((current) => ({ ...current, serviceType: event.target.value }))}>
                <option value="">Any service</option>
                {SERVICE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Available day</span>
              <select className="input" value={filters.day} onChange={(event) => setFilters((current) => ({ ...current, day: event.target.value }))}>
                <option value="">Any day</option>
                {DAYS.map((day) => <option key={day} value={day}>{day}</option>)}
              </select>
            </label>
            <div className="field" style={{ alignSelf: "end" }}>
              <Button type="button" onClick={() => loadCaregivers(filters)}>
                <SearchIcon size={18} /> Search
              </Button>
            </div>
          </div>
        </Card>

        {loading && <div className="page-loader-inline"><span className="spinner" /> Loading caregivers</div>}
        {error && <div className="alert alert--error">{error}</div>}

        {!loading && !caregivers.length && (
          <Card className="empty-state">
            <span className="feature-icon"><AlertIcon /></span>
            <h2>No caregivers match those filters.</h2>
            <p>Try a different service or day selection.</p>
          </Card>
        )}

        <div className="profile-grid">
          {caregivers.map((caregiver) => (
            <CaregiverCard key={caregiver._id} caregiver={caregiver} onBook={openBookingModal} />
          ))}
        </div>
      </div>

      <Modal isOpen={Boolean(selectedCaregiver)} title={`Book ${selectedCaregiver?.name || "caregiver"}`} onClose={() => setSelectedCaregiver(null)}>
        {selectedCaregiver && (
          <form onSubmit={submitBooking} style={{ display: "grid", gap: 18 }}>
            <div className="form-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              <label className="field">
                <span>Booking type</span>
                <select className="input" value={bookingForm.bookingType} onChange={(event) => setBookingForm((current) => ({ ...current, bookingType: event.target.value }))}>
                  {BOOKING_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Service type</span>
                <select className="input" value={bookingForm.serviceType} onChange={(event) => setBookingForm((current) => ({ ...current, serviceType: event.target.value }))}>
                  {selectedCaregiver.supportedServiceTypes?.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Start date</span>
                <input className="input" type="date" value={bookingForm.startDate} onChange={(event) => setBookingForm((current) => ({ ...current, startDate: event.target.value }))} required />
              </label>
              {bookingForm.bookingType !== "one-time" && (
                <label className="field">
                  <span>End date</span>
                  <input className="input" type="date" value={bookingForm.endDate} onChange={(event) => setBookingForm((current) => ({ ...current, endDate: event.target.value }))} required />
                </label>
              )}
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <strong>Available slots</strong>
                <span style={{ color: "var(--muted)", fontSize: ".8rem" }}>Select one</span>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {availableSlots.length ? (
                  availableSlots.map((slot) => (
                    <button
                      type="button"
                      key={`${slot.day}-${slot.startTime}-${slot.endTime}`}
                      className="button button--secondary"
                      style={{ justifyContent: "space-between", width: "100%", border: bookingForm.timeSlot === `${slot.startTime}-${slot.endTime}` ? "1px solid var(--primary)" : "1px solid var(--border)" }}
                      onClick={() => handleSlotChange(slot)}
                    >
                      <span style={{ textTransform: "capitalize" }}>{slot.day}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}><ClockIcon size={16} /> {toDisplayTime(slot.startTime, slot.endTime)}</span>
                    </button>
                  ))
                ) : (
                  <div className="empty-state">No matching availability for the current filter.</div>
                )}
              </div>
            </div>

            {formError && <div className="alert alert--error">{formError}</div>}

            <div className="modal-actions">
              <Button type="button" variant="secondary" onClick={() => setSelectedCaregiver(null)}>Cancel</Button>
              <Button type="submit" isLoading={isSubmitting} disabled={!bookingForm.timeSlot || !bookingForm.startDate || (bookingForm.bookingType !== "one-time" && !bookingForm.endDate)}>
                <CheckIcon size={16} /> Confirm booking
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </main>
  );
}
