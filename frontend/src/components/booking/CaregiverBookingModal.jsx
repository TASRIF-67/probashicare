import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../Button.jsx";
import { BridgeLoader } from "../BridgeLoader.jsx";
import { Modal } from "../Modal.jsx";
import { CalendarIcon, CheckIcon, ClockIcon } from "../Icons.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { bookingService } from "../../services/bookingService.js";
import { elderlyProfileService } from "../../services/elderlyProfileService.js";
import { normalizeApiError } from "../../services/api.js";

const BOOKING_TYPES = [
  {
    value: "one-time",
    label: "One-time visit",
    description: "Care on one selected day",
  },
  {
    value: "scheduled",
    label: "Scheduled weekly care",
    description: "Repeat selected weekdays",
  },
  {
    value: "long-term",
    label: "Long-term weekly care",
    description: "At least four weeks",
  },
];

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const ACTIVE_BOOKING_STATUSES = ["pending", "accepted", "confirmed"];

/**
 * Returns the lowercase weekday for a date-input value.
 * @param {string} value - Date in YYYY-MM-DD format.
 * @returns {string} Lowercase weekday, or an empty string for no value.
 * @sideEffects None.
 */
function dayForDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value + "T00:00:00Z");
  return WEEKDAYS[date.getUTCDay()];
}

/**
 * Returns today's local calendar date for a native date input.
 * @returns {string} Date in YYYY-MM-DD format.
 * @sideEffects Reads the device clock.
 */
function today() {
  const value = new Date();
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

/**
 * Finds all weekdays that occur inside an inclusive date range.
 * @param {string} start - Start date in YYYY-MM-DD format.
 * @param {string} end - End date in YYYY-MM-DD format.
 * @returns {Set<string>} Unique lowercase weekdays in the range.
 * @sideEffects None.
 */
function weekdaysInRange(start, end) {
  const result = new Set();

  if (!start || !end || end < start) {
    return result;
  }

  const cursor = new Date(start + "T00:00:00Z");
  const last = new Date(end + "T00:00:00Z");

  while (cursor <= last) {
    const dateValue = cursor.toISOString().slice(0, 10);
    result.add(dayForDate(dateValue));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return result;
}

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
 * Formats a booking occurrence date for display.
 * @param {string|Date} value - Stored occurrence date.
 * @returns {string} Human-readable date.
 * @sideEffects None.
 */
function formatDate(value) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

/**
 * Returns a stable YYYY-MM-DD key for a stored occurrence date.
 * @param {string|Date} value - Stored occurrence date.
 * @returns {string} UTC calendar-date key.
 * @sideEffects None.
 */
function getDateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

/**
 * Builds the family's upcoming active visit list from booking responses.
 * @param {Array<object>} bookings - Family bookings returned by the API.
 * @returns {Array<object>} Flattened visits ordered by date.
 * @sideEffects None.
 */
function collectUpcomingVisits(bookings) {
  const visits = [];
  const currentDate = today();

  for (const booking of bookings) {
    if (!ACTIVE_BOOKING_STATUSES.includes(booking.status)) {
      continue;
    }

    for (const occurrence of booking.occurrences || []) {
      const occurrenceDate = getDateKey(occurrence.date);

      if (occurrenceDate < currentDate) {
        continue;
      }

      visits.push({
        bookingId: booking._id,
        caregiverName: booking.caregiver?.name || "Caregiver",
        elderlyName: booking.elderlyProfile?.name || "Care recipient",
        date: occurrenceDate,
        timeSlot: occurrence.timeSlot,
        status: booking.status,
      });
    }
  }

  visits.sort(function compareVisits(firstVisit, secondVisit) {
    return firstVisit.date.localeCompare(secondVisit.date);
  });

  return visits;
}

/**
 * Lists the actual dates produced by the currently selected weekly slots.
 * @param {object} form - Current booking form state.
 * @param {Array<object>} slots - Selected weekday and time slots.
 * @returns {Array<string>} Selected occurrence dates in YYYY-MM-DD format.
 * @sideEffects None.
 */
function getSelectedOccurrenceDates(form, slots) {
  const dates = [];

  if (!form.startDate || slots.length === 0) {
    return dates;
  }

  const endDate = form.bookingType === "one-time"
    ? form.startDate
    : form.endDate;

  if (!endDate) {
    return dates;
  }

  const selectedWeekdays = new Set();

  for (const slot of slots) {
    selectedWeekdays.add(slot.weekday);
  }

  const cursor = new Date(form.startDate + "T00:00:00Z");
  const last = new Date(endDate + "T00:00:00Z");

  while (cursor <= last) {
    const dateValue = cursor.toISOString().slice(0, 10);

    if (selectedWeekdays.has(dayForDate(dateValue))) {
      dates.push(dateValue);
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

/**
 * Displays a date input with a button that opens the browser calendar.
 * @param {{label: import("react").ReactNode, value: string, min: string, disabled: boolean, onChange: Function}} props - Date-field label, limits, state, and handler.
 * @returns {import("react").ReactElement} Accessible native date field.
 * @sideEffects Opens browser calendar UI and calls the change handler.
 */
function BookingDateField({ label, value, min, disabled, onChange }) {
  const inputReference = useRef(null);

  /**
   * Opens the native calendar or focuses the date input as a fallback.
   * @returns {void}
   * @sideEffects Opens browser UI or moves keyboard focus.
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

/**
 * Lets a family review existing care dates and request a caregiver schedule.
 * @param {{caregiver: object|null, onClose: () => void}} props - Selected caregiver and close handler.
 * @returns {import("react").ReactElement} Caregiver booking dialog.
 * @sideEffects Loads profiles and bookings, then may create a booking.
 */
export function CaregiverBookingModal({ caregiver, onClose }) {
  const { showToast } = useToast();
  const [profiles, setProfiles] = useState([]);
  const [familyBookings, setFamilyBookings] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    elderlyProfileId: "",
    bookingType: "one-time",
    serviceType: "",
    startDate: "",
    endDate: "",
    selectedSlots: {},
  });

  useEffect(() => {
    let cancelled = false;

    if (!caregiver) {
      return undefined;
    }

    setForm({
      elderlyProfileId: "",
      bookingType: "one-time",
      serviceType: caregiver.supportedServiceTypes?.[0] || "companionship",
      startDate: "",
      endDate: "",
      selectedSlots: {},
    });
    setError("");
    setLoadingData(true);

    /**
     * Loads authorized care recipients and the family's current bookings.
     * @returns {Promise<void>}
     * @sideEffects Updates modal state unless the effect was cleaned up.
     */
    async function loadBookingData() {
      try {
        const results = await Promise.all([
          elderlyProfileService.listProfiles(),
          bookingService.listMyBookings(),
        ]);

        if (cancelled) {
          return;
        }

        const profileResult = results[0].profiles || [];
        const bookingResult = results[1].bookings || [];
        setProfiles(profileResult);
        setFamilyBookings(bookingResult);
        setForm(function selectFirstProfile(current) {
          return {
            ...current,
            elderlyProfileId: profileResult[0]?._id || "",
          };
        });
      } catch (requestError) {
        if (!cancelled) {
          setError(normalizeApiError(requestError).message);
        }
      } finally {
        if (!cancelled) {
          setLoadingData(false);
        }
      }
    }

    loadBookingData();

    return function stopStateUpdates() {
      cancelled = true;
    };
  }, [caregiver]);

  const upcomingVisits = useMemo(function buildUpcomingVisits() {
    return collectUpcomingVisits(familyBookings);
  }, [familyBookings]);

  const bookedDateSet = useMemo(function buildBookedDateSet() {
    const dates = new Set();

    for (const visit of upcomingVisits) {
      dates.add(visit.date);
    }

    return dates;
  }, [upcomingVisits]);

  const visibleSlots = useMemo(function findVisibleSlots() {
    const availability = caregiver?.availability || [];

    if (form.bookingType === "one-time") {
      return availability.filter(function matchesSelectedDate(slot) {
        return slot.day === dayForDate(form.startDate);
      });
    }

    const weekdays = weekdaysInRange(form.startDate, form.endDate);
    return availability.filter(function occursInRange(slot) {
      return weekdays.has(slot.day);
    });
  }, [caregiver, form.bookingType, form.startDate, form.endDate]);

  const slots = [];

  for (const entry of Object.entries(form.selectedSlots)) {
    const weekday = entry[0];
    const times = entry[1].split("-");
    slots.push({
      weekday,
      startTime: times[0],
      endTime: times[1],
    });
  }

  const conflictingDates = [];
  const selectedOccurrenceDates = getSelectedOccurrenceDates(form, slots);

  for (const date of selectedOccurrenceDates) {
    if (bookedDateSet.has(date)) {
      conflictingDates.push(date);
    }
  }

  const hasConflict = conflictingDates.length > 0;
  const hasRequiredDates = form.bookingType === "one-time" || form.endDate;
  const isValid = Boolean(
    form.elderlyProfileId
    && form.startDate
    && slots.length
    && hasRequiredDates
    && !hasConflict,
  );

  /**
   * Closes the modal when a request is not being submitted.
   * @returns {void}
   * @sideEffects Calls the parent close handler.
   */
  function close() {
    if (!submitting) {
      onClose();
    }
  }

  /**
   * Updates one form field and clears schedule choices when dates change.
   * @param {string} field - Form field name.
   * @param {string} value - New field value.
   * @returns {void}
   * @sideEffects Updates form and error state.
   */
  function updateField(field, value) {
    setForm(function updateCurrentForm(current) {
      const nextForm = {
        ...current,
        [field]: value,
      };

      if (["bookingType", "startDate", "endDate"].includes(field)) {
        nextForm.selectedSlots = {};
      }

      if (field === "bookingType" && value === "one-time") {
        nextForm.endDate = "";
      }

      return nextForm;
    });
    setError("");
  }

  /**
   * Selects or removes a caregiver availability slot.
   * @param {{day: string, startTime: string, endTime: string}} slot - Chosen weekly slot.
   * @returns {void}
   * @sideEffects Updates the selected schedule.
   */
  function toggleSlot(slot) {
    const timeSlot = slot.startTime + "-" + slot.endTime;

    setForm(function updateSelectedSlots(current) {
      const selected = {
        ...current.selectedSlots,
      };

      if (selected[slot.day] === timeSlot) {
        delete selected[slot.day];
      } else {
        selected[slot.day] = timeSlot;
      }

      if (current.bookingType === "one-time") {
        return {
          ...current,
          selectedSlots: {
            [slot.day]: timeSlot,
          },
        };
      }

      return {
        ...current,
        selectedSlots: selected,
      };
    });
  }

  /**
   * Removes every selected weekly slot.
   * @returns {void}
   * @sideEffects Clears selected slots from form state.
   */
  function clearSlots() {
    setForm(function clearCurrentSlots(current) {
      return {
        ...current,
        selectedSlots: {},
      };
    });
  }

  /**
   * Sends the validated booking request to the API.
   * @param {import("react").FormEvent<HTMLFormElement>} event - Form submission event.
   * @returns {Promise<void>}
   * @sideEffects Creates a booking, shows a toast, and closes the modal.
   */
  async function submit(event) {
    event.preventDefault();

    if (!isValid || submitting) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await bookingService.createBooking({
        caregiverId: caregiver._id,
        elderlyProfileId: form.elderlyProfileId,
        bookingType: form.bookingType,
        serviceType: form.serviceType,
        startDate: form.startDate,
        endDate: form.bookingType === "one-time"
          ? form.startDate
          : form.endDate,
        slots,
      });
      showToast("Booking request sent successfully.", "success");
      onClose();
    } catch (requestError) {
      setError(normalizeApiError(requestError).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={Boolean(caregiver)}
      title={"Book " + (caregiver?.name || "caregiver")}
      className="modal--booking"
      onClose={close}
    >
      {caregiver && (
        <form onSubmit={submit} className="booking-form">
          <section className="booking-context-card">
            <div className="booking-context-card__heading">
              <span className="feature-icon feature-icon--small">
                <CalendarIcon size={19} />
              </span>
              <div>
                <strong>Weekly availability</strong>
                <p>Choose dates that match these working hours.</p>
              </div>
            </div>
            {caregiver.availability?.length ? (
              <div className="booking-availability-chips">
                {caregiver.availability.map(function renderAvailability(slot, index) {
                  return (
                    <div
                      className="booking-availability-chip"
                      key={slot.day + "-" + slot.startTime + "-" + slot.endTime + "-" + index}
                    >
                      <strong>{formatWeekday(slot.day)}</strong>
                      <span>
                        <ClockIcon size={14} />
                        {slot.startTime} - {slot.endTime}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="booking-context-card__empty">
                This caregiver has not provided weekly availability yet.
              </p>
            )}
          </section>

          <section className="family-booked-dates" aria-labelledby="booked-care-heading">
            <div className="family-booked-dates__heading">
              <div>
                <strong id="booked-care-heading">Your upcoming booked care</strong>
                <p>These dates cannot be booked again.</p>
              </div>
              <Link to="/bookings" onClick={close}>View all</Link>
            </div>
            {loadingData ? (
              <BridgeLoader
                compact
                label="Connecting your care calendar"
              />
            ) : upcomingVisits.length ? (
              <div className="family-booked-dates__list">
                {upcomingVisits.slice(0, 3).map(function renderVisit(visit) {
                  return (
                    <div
                      className="family-booked-date"
                      key={visit.bookingId + "-" + visit.date + "-" + visit.timeSlot}
                    >
                      <span className="family-booked-date__day">
                        <strong>{formatDate(visit.date)}</strong>
                        <small>{visit.timeSlot}</small>
                      </span>
                      <span className="family-booked-date__care">
                        {visit.caregiverName} for {visit.elderlyName}
                      </span>
                      <span className={"status-badge status-badge--" + visit.status}>
                        {visit.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="family-booked-dates__empty">
                You have no upcoming active bookings.
              </p>
            )}
          </section>

          {profiles.length === 1 ? (
            <div className="booking-recipient-summary">
              <span>Care recipient</span>
              <strong>
                {profiles[0].personalInformation.preferredName
                  || profiles[0].personalInformation.fullName}
              </strong>
            </div>
          ) : (
            <label className="field">
              <span>Care recipient</span>
              <select
                className="input"
                value={form.elderlyProfileId}
                disabled={loadingData || submitting}
                onChange={function changeProfile(event) {
                  updateField("elderlyProfileId", event.target.value);
                }}
                required
              >
                <option value="">Select an elderly profile</option>
                {profiles.map(function renderProfile(profile) {
                  const information = profile.personalInformation;
                  return (
                    <option key={profile._id} value={profile._id}>
                      {information.preferredName || information.fullName}
                    </option>
                  );
                })}
              </select>
            </label>
          )}

          <fieldset className="booking-choice-group">
            <legend>How often is care needed?</legend>
            <div className="booking-choice-list booking-choice-list--types">
              {BOOKING_TYPES.map(function renderType(type) {
                const selected = form.bookingType === type.value;
                return (
                  <button
                    type="button"
                    className={selected ? "is-selected" : ""}
                    aria-pressed={selected}
                    disabled={submitting}
                    key={type.value}
                    onClick={function chooseBookingType() {
                      updateField("bookingType", type.value);
                    }}
                  >
                    <strong>{type.label}</strong>
                    <span>{type.description}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="booking-choice-group">
            <legend>Choose a service</legend>
            <div className="booking-choice-list">
              {caregiver.supportedServiceTypes?.map(function renderService(type) {
                const selected = form.serviceType === type;
                return (
                  <button
                    type="button"
                    className={selected ? "is-selected" : ""}
                    aria-pressed={selected}
                    disabled={submitting}
                    key={type}
                    onClick={function chooseService() {
                      updateField("serviceType", type);
                    }}
                  >
                    {type.replaceAll("-", " ")}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="form-grid booking-form__grid booking-date-grid">
            <BookingDateField
              label="Start date"
              min={today()}
              value={form.startDate}
              disabled={submitting}
              onChange={function changeStartDate(event) {
                updateField("startDate", event.target.value);
              }}
            />
            {form.bookingType !== "one-time" && (
              <BookingDateField
                label={form.bookingType === "long-term"
                  ? "End date (minimum 28 days)"
                  : "End date"}
                min={form.startDate || today()}
                value={form.endDate}
                disabled={submitting}
                onChange={function changeEndDate(event) {
                  updateField("endDate", event.target.value);
                }}
              />
            )}
          </div>

          <section className="booking-slots">
            <div className="booking-slots__heading">
              <strong>Available slots</strong>
              <span>
                {form.bookingType === "one-time"
                  ? "Matches the selected date"
                  : "Repeats weekly in the date range"}
              </span>
            </div>
            {!form.startDate || (form.bookingType !== "one-time" && !form.endDate) ? (
              <div className="empty-state">
                Choose the complete date range to see matching slots.
              </div>
            ) : visibleSlots.length ? (
              <div className="booking-slot-grid">
                {visibleSlots.map(function renderSlot(slot) {
                  const value = slot.startTime + "-" + slot.endTime;
                  const selected = form.selectedSlots[slot.day] === value;
                  return (
                    <button
                      type="button"
                      className={"booking-slot " + (selected ? "booking-slot--selected" : "")}
                      aria-pressed={selected}
                      disabled={submitting}
                      key={slot.day + "-" + value}
                      onClick={function chooseSlot() {
                        toggleSlot(slot);
                      }}
                    >
                      <span>{formatWeekday(slot.day)}</span>
                      <span>
                        <ClockIcon size={16} />
                        {slot.startTime} - {slot.endTime}
                      </span>
                      {selected && <CheckIcon size={17} />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                No availability occurs inside this date range.
              </div>
            )}
          </section>

          <section className="selected-schedule">
            <div>
              <strong>Selected schedule</strong>
              <button
                type="button"
                disabled={!slots.length || submitting}
                onClick={clearSlots}
              >
                Clear slots
              </button>
            </div>
            {slots.length ? slots.map(function renderSelectedSlot(slot) {
              return (
                <p key={slot.weekday}>
                  <CheckIcon size={15} />
                  <span>{formatWeekday(slot.weekday)}</span>
                  {slot.startTime} - {slot.endTime}, from {form.startDate} to {form.bookingType === "one-time"
                    ? form.startDate
                    : form.endDate}
                </p>
              );
            }) : (
              <p>No slots selected yet.</p>
            )}
          </section>

          {hasConflict && (
            <div className="alert alert--error" role="alert">
              You already have booked care on {conflictingDates.map(formatDate).join(", ")}.
              Choose a different date or date range.
            </div>
          )}
          {error && <div className="alert alert--error">{error}</div>}
          <div className="modal-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={submitting}
              onClick={close}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={submitting}
              disabled={!isValid || loadingData}
            >
              <CheckIcon size={16} />
              Confirm booking
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
