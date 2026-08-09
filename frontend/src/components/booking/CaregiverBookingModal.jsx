import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../Button.jsx";
import { Modal } from "../Modal.jsx";
import { CalendarIcon, CheckIcon, ClockIcon } from "../Icons.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { bookingService } from "../../services/bookingService.js";
import { elderlyProfileService } from "../../services/elderlyProfileService.js";
import { normalizeApiError } from "../../services/api.js";

const TYPES = [{ value: "one-time", label: "One-time visit" }, { value: "scheduled", label: "Scheduled weekly care" }, { value: "long-term", label: "Long-term weekly care" }];
const dayForDate = (value) => value ? ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][new Date(`${value}T00:00:00Z`).getUTCDay()] : "";
const today = () => { const value = new Date(); return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`; };
const weekdaysInRange = (start, end) => {
  if (!start || !end || end < start) return new Set();
  const result = new Set();
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) { result.add(dayForDate(cursor.toISOString().slice(0, 10))); cursor.setUTCDate(cursor.getUTCDate() + 1); }
  return result;
};

/**
 * Converts a stored lowercase weekday into a readable label.
 * @param {string} day - Stored caregiver availability weekday.
 * @returns {string} Weekday with its first letter capitalized.
 * @sideEffects None.
 */
function formatWeekday(day) {
  if (!day) {
    return "Day unavailable";
  }

  return day.charAt(0).toUpperCase() + day.slice(1);
}

/**
 * Displays a date input with a clear button that opens the browser calendar.
 * @param {{label: import("react").ReactNode, value: string, min: string, disabled: boolean, onChange: Function}} props - Date-field label, limits, state, and change handler.
 * @returns {import("react").ReactElement} Accessible native date field.
 * @sideEffects Opens the browser date picker and calls the change handler after selection.
 */
function BookingDateField({
  label,
  value,
  min,
  disabled,
  onChange,
}) {
  const inputReference = useRef(null);

  /**
   * Opens the native calendar or focuses the date input as a fallback.
   * @returns {void}
   * @sideEffects Opens browser UI or moves keyboard focus to the input.
   */
  function openCalendar() {
    const input = inputReference.current;

    if (!input || disabled) {
      return;
    }

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.focus();
  }

  return (
    <label className="field">
      <span>{label}</span>
      <span className="booking-date-field">
        <input
          ref={inputReference}
          className="input booking-date-input"
          type="date"
          min={min}
          value={value}
          disabled={disabled}
          onChange={onChange}
          required
        />
        <button
          className="booking-calendar-button"
          type="button"
          aria-label={"Open calendar for " + label}
          disabled={disabled}
          onClick={openCalendar}
        >
          <CalendarIcon size={19} />
        </button>
      </span>
    </label>
  );
}

export function CaregiverBookingModal({ caregiver, onClose }) {
  const { showToast } = useToast();
  const [profiles, setProfiles] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ elderlyProfileId: "", bookingType: "one-time", serviceType: "", startDate: "", endDate: "", selectedSlots: {} });

  useEffect(() => {
    if (!caregiver) return;
    setForm({ elderlyProfileId: "", bookingType: "one-time", serviceType: caregiver.supportedServiceTypes?.[0] || "companionship", startDate: "", endDate: "", selectedSlots: {} });
    setError("");
    setLoadingProfiles(true);
    elderlyProfileService.listProfiles().then(({ profiles: result }) => { setProfiles(result); setForm((current) => ({ ...current, elderlyProfileId: result[0]?._id || "" })); }).catch((requestError) => setError(normalizeApiError(requestError).message)).finally(() => setLoadingProfiles(false));
  }, [caregiver]);

  const visibleSlots = useMemo(() => {
    const slots = caregiver?.availability || [];
    if (form.bookingType === "one-time") return slots.filter((slot) => slot.day === dayForDate(form.startDate));
    const weekdays = weekdaysInRange(form.startDate, form.endDate);
    return slots.filter((slot) => weekdays.has(slot.day));
  }, [caregiver, form.bookingType, form.startDate, form.endDate]);
  const slots = Object.entries(form.selectedSlots).map(([weekday, value]) => { const [startTime, endTime] = value.split("-"); return { weekday, startTime, endTime }; });
  const isValid = form.elderlyProfileId && form.startDate && slots.length && (form.bookingType === "one-time" || form.endDate);
  const close = () => { if (!submitting) onClose(); };

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value, ...(["bookingType", "startDate", "endDate"].includes(field) ? { selectedSlots: {} } : {}), ...(field === "bookingType" && value === "one-time" ? { endDate: "" } : {}) }));
    setError("");
  }

  function toggleSlot(slot) {
    const timeSlot = `${slot.startTime}-${slot.endTime}`;
    setForm((current) => {
      const selected = { ...current.selectedSlots };
      if (selected[slot.day] === timeSlot) delete selected[slot.day];
      else selected[slot.day] = timeSlot;
      return { ...current, selectedSlots: current.bookingType === "one-time" ? { [slot.day]: timeSlot } : selected };
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await bookingService.createBooking({ caregiverId: caregiver._id, elderlyProfileId: form.elderlyProfileId, bookingType: form.bookingType, serviceType: form.serviceType, startDate: form.startDate, endDate: form.bookingType === "one-time" ? form.startDate : form.endDate, slots });
      showToast("Booking request sent successfully.", "success");
      onClose();
    } catch (requestError) {
      setError(normalizeApiError(requestError).message);
    } finally {
      setSubmitting(false);
    }
  }

  return <Modal isOpen={Boolean(caregiver)} title={`Book ${caregiver?.name || "caregiver"}`} onClose={close}>
    {caregiver && <form onSubmit={submit} className="booking-form">
      <section className="caregiver-availability-preview">
        <div className="caregiver-availability-preview__heading">
          <div>
            <strong>Caregiver weekly availability</strong>
            <span>Use these working days to choose a matching date.</span>
          </div>
          <CalendarIcon size={20} />
        </div>
        {caregiver.availability?.length ? (
          <div className="caregiver-availability-preview__list">
            {caregiver.availability.map((slot, index) => (
              <div
                className="caregiver-availability-preview__slot"
                key={`${slot.day}-${slot.startTime}-${slot.endTime}-${index}`}
              >
                <strong>{formatWeekday(slot.day)}</strong>
                <span>
                  <ClockIcon size={15} />
                  {slot.startTime} - {slot.endTime}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            This caregiver has not provided weekly availability yet.
          </div>
        )}
      </section>
      <div className="form-grid booking-form__grid">
        <label className="field"><span>Care recipient</span><select className="input" value={form.elderlyProfileId} disabled={loadingProfiles || submitting} onChange={(event) => updateField("elderlyProfileId", event.target.value)} required><option value="">Select an elderly profile</option>{profiles.map((profile) => <option key={profile._id} value={profile._id}>{profile.personalInformation.preferredName || profile.personalInformation.fullName}</option>)}</select></label>
        <label className="field"><span>Booking type</span><select className="input" value={form.bookingType} disabled={submitting} onChange={(event) => updateField("bookingType", event.target.value)}>{TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
        <label className="field"><span>Service</span><select className="input" value={form.serviceType} disabled={submitting} onChange={(event) => updateField("serviceType", event.target.value)}>{caregiver.supportedServiceTypes?.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
        <BookingDateField
          label="Start date"
          min={today()}
          value={form.startDate}
          disabled={submitting}
          onChange={(event) => updateField("startDate", event.target.value)}
        />
        {form.bookingType !== "one-time" && (
          <BookingDateField
            label={
              form.bookingType === "long-term"
                ? "End date (minimum 28 days)"
                : "End date"
            }
            min={form.startDate || today()}
            value={form.endDate}
            disabled={submitting}
            onChange={(event) => updateField("endDate", event.target.value)}
          />
        )}
      </div>
      <section className="booking-slots"><div className="booking-slots__heading"><strong>Available slots</strong><span>{form.bookingType === "one-time" ? "Matches the selected date" : "Repeats weekly in the date range"}</span></div>
        {(!form.startDate || (form.bookingType !== "one-time" && !form.endDate)) ? <div className="empty-state">Choose the complete date range to see matching slots.</div> : visibleSlots.length ? <div className="booking-slot-grid">{visibleSlots.map((slot) => { const value = `${slot.startTime}-${slot.endTime}`; const selected = form.selectedSlots[slot.day] === value; return <button type="button" className={`booking-slot ${selected ? "booking-slot--selected" : ""}`} aria-pressed={selected} disabled={submitting} key={`${slot.day}-${value}`} onClick={() => toggleSlot(slot)}><span>{slot.day}</span><span><ClockIcon size={16} /> {slot.startTime}-{slot.endTime}</span>{selected && <CheckIcon size={17} />}</button>; })}</div> : <div className="empty-state">No availability occurs inside this date range.</div>}
      </section>
      <section className="selected-schedule"><div><strong>Selected schedule</strong><button type="button" disabled={!slots.length || submitting} onClick={() => setForm((current) => ({ ...current, selectedSlots: {} }))}>Clear slots</button></div>{slots.length ? slots.map((slot) => <p key={slot.weekday}><CheckIcon size={15} /><span>{slot.weekday}</span> {slot.startTime}-{slot.endTime}, only within {form.startDate} to {form.bookingType === "one-time" ? form.startDate : form.endDate}</p>) : <p>No slots selected yet.</p>}</section>
      {error && <div className="alert alert--error">{error}</div>}
      <div className="modal-actions"><Button type="button" variant="secondary" disabled={submitting} onClick={close}>Cancel</Button><Button type="submit" isLoading={submitting} disabled={!isValid || loadingProfiles}><CheckIcon size={16} /> Confirm booking</Button></div>
    </form>}
  </Modal>;
}
