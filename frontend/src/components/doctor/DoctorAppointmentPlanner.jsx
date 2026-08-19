import { useEffect, useState } from "react";
import { AppHeader } from "../AppHeader.jsx";
import { Button } from "../Button.jsx";
import { Card } from "../Card.jsx";
import { Input } from "../Input.jsx";
import { Modal } from "../Modal.jsx";
import {
  CalendarIcon,
  CheckIcon,
  MapPinIcon,
  PhoneIcon,
  PlusIcon,
  StethoscopeIcon,
  TrashIcon,
  UserIcon,
} from "../Icons.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { caregiverService } from "../../services/caregiverService.js";
import { elderlyProfileService } from "../../services/elderlyProfileService.js";
import { doctorAppointmentService } from "../../services/doctorAppointmentService.js";
import { normalizeApiError } from "../../services/api.js";

const EMPTY_FORM = {
  elderlyId: "",
  caregiverUserId: "",
  doctorName: "",
  specialty: "",
  clinicName: "",
  clinicAddress: "",
  contactPhone: "",
  appointmentDate: "",
  notes: "",
};

/**
 * Formats an appointment date for the user's locale.
 * @param {string|Date} value - Stored date value.
 * @returns {string} Readable date and time.
 * @sideEffects None.
 */
function formatDateTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Returns the best available elderly-profile display name.
 * @param {object|null|undefined} profile - Elderly profile record.
 * @returns {string} Profile display name.
 * @sideEffects None.
 */
function getProfileName(profile) {
  return (
    profile?.personalInformation?.fullName
    || profile?.name
    || "Elderly profile"
  );
}

/**
 * Checks whether an appointment is scheduled in the future.
 * @param {object} appointment - Appointment record.
 * @returns {boolean} True when the appointment is upcoming.
 * @sideEffects Reads the current system time.
 */
function isUpcoming(appointment) {
  const appointmentTime = new Date(
    appointment.appointmentDate,
  ).getTime();

  return (
    !Number.isNaN(appointmentTime)
    && appointment.status === "scheduled"
    && appointmentTime >= Date.now()
  );
}

/**
 * Returns a readable appointment status.
 * @param {string} status - Stored status.
 * @returns {string} User-facing status label.
 * @sideEffects None.
 */
function getStatusLabel(status) {
  if (status === "completed") {
    return "Completed";
  }

  if (status === "cancelled") {
    return "Cancelled";
  }

  if (status === "rejected") {
    return "Caregiver declined";
  }

  return "Scheduled";
}

/**
 * Renders one family doctor-visit record.
 * @param {{appointment: object, isBusy: boolean, onStatusChange: Function, onDelete: Function}} props - Appointment data and actions.
 * @returns {import("react").ReactElement} Doctor visit card.
 * @sideEffects Calls supplied actions after button clicks.
 */
function AppointmentCard({
  appointment,
  isBusy,
  onStatusChange,
  onDelete,
}) {
  return (
    <article className="doctor-visit-card">
      <div className="doctor-visit-card__date">
        <CalendarIcon size={18} />
        <strong>
          {formatDateTime(appointment.appointmentDate)}
        </strong>
      </div>

      <div className="doctor-visit-card__heading">
        <div>
          <span>{appointment.specialty}</span>
          <h2>{appointment.doctorName}</h2>
        </div>
        <span
          className={
            `doctor-status doctor-status--${appointment.status}`
          }
        >
          {getStatusLabel(appointment.status)}
        </span>
      </div>

      <div className="doctor-visit-card__details">
        <div>
          <StethoscopeIcon size={16} />
          <span>
            <small>Clinic</small>
            <strong>{appointment.clinicName}</strong>
          </span>
        </div>
        <div>
          <MapPinIcon size={16} />
          <span>
            <small>Location</small>
            <strong>{appointment.clinicAddress}</strong>
          </span>
        </div>
        <div>
          <PhoneIcon size={16} />
          <span>
            <small>Contact</small>
            <strong>{appointment.contactPhone}</strong>
          </span>
        </div>
        <div>
          <UserIcon size={16} />
          <span>
            <small>Escort</small>
            <strong>
              {appointment.caregiverUserId?.name
                || "Not assigned"}
            </strong>
          </span>
        </div>
      </div>

      {appointment.notes && (
        <p className="doctor-visit-card__notes">
          <strong>Preparation:</strong>{" "}
          {appointment.notes}
        </p>
      )}

      {appointment.googleCalendarEventId && (
        <p className="doctor-calendar-state">
          <CheckIcon size={15} />
          Synchronized with Google Calendar
        </p>
      )}

      {appointment.status === "rejected"
        && appointment.statusReason && (
          <div className="doctor-response" role="status">
            <strong>Caregiver response</strong>
            <p>{appointment.statusReason}</p>
          </div>
        )}

      <div className="doctor-visit-card__actions">
        {appointment.status === "scheduled" && (
          <>
            <Button
              variant="secondary"
              disabled={isBusy}
              onClick={() =>
                onStatusChange(
                  appointment._id,
                  "completed",
                )
              }
            >
              <CheckIcon size={16} />
              Mark completed
            </Button>
            <Button
              variant="ghost"
              disabled={isBusy}
              onClick={() =>
                onStatusChange(
                  appointment._id,
                  "cancelled",
                )
              }
            >
              Cancel visit
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          disabled={isBusy}
          onClick={() => onDelete(appointment._id)}
        >
          <TrashIcon size={16} />
          Remove
        </Button>
      </div>
    </article>
  );
}

/**
 * Renders the family doctor-appointment planner and history.
 * @param {void} _unused - This component accepts no props.
 * @returns {import("react").ReactElement} Appointment workspace and form.
 * @sideEffects Loads and changes appointments through authenticated APIs.
 */
export function DoctorAppointmentPlanner() {
  const { showToast } = useToast();
  const [profiles, setProfiles] = useState([]);
  const [caregivers, setCaregivers] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [selectedTab, setSelectedTab] = useState("upcoming");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [busyAppointmentId, setBusyAppointmentId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});

  const upcomingAppointments = [];
  const appointmentHistory = [];

  for (const appointment of appointments) {
    if (isUpcoming(appointment)) {
      upcomingAppointments.push(appointment);
    } else {
      appointmentHistory.push(appointment);
    }
  }

  const visibleAppointments =
    selectedTab === "upcoming"
      ? upcomingAppointments
      : appointmentHistory;

  useEffect(() => {
    let isCancelled = false;

    /**
     * Loads profile and caregiver choices.
     * @returns {Promise<void>}
     * @sideEffects Requests API data and updates state.
     */
    async function loadOptions() {
      try {
        const profileResult =
          await elderlyProfileService.listProfiles("active");
        const nextProfiles = profileResult.profiles || [];

        if (isCancelled) {
          return;
        }

        setProfiles(nextProfiles);

        if (nextProfiles.length > 0) {
          const firstProfileId = nextProfiles[0]._id;
          setSelectedProfileId(firstProfileId);
          setForm((currentForm) => ({
            ...currentForm,
            elderlyId: firstProfileId,
          }));
        }

        const caregiverResult =
          await caregiverService.listCaregivers();

        if (!isCancelled) {
          setCaregivers(caregiverResult.caregivers || []);
        }
      } catch (error) {
        if (!isCancelled) {
          showToast(
            normalizeApiError(error).message,
            "error",
          );
        }
      }
    }

    loadOptions();

    return () => {
      isCancelled = true;
    };
  }, [showToast]);

  useEffect(() => {
    let isCancelled = false;

    if (!selectedProfileId) {
      setAppointments([]);
      setIsLoading(false);
      return undefined;
    }

    /**
     * Loads appointments for the selected elderly profile.
     * @returns {Promise<void>}
     * @sideEffects Requests API data and updates state.
     */
    async function loadAppointments() {
      try {
        setIsLoading(true);
        const result =
          await doctorAppointmentService.listAppointments(
            selectedProfileId,
          );

        if (!isCancelled) {
          setAppointments(result.appointments || []);
        }
      } catch (error) {
        if (!isCancelled) {
          showToast(
            normalizeApiError(error).message,
            "error",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadAppointments();

    return () => {
      isCancelled = true;
    };
  }, [selectedProfileId, showToast]);

  /**
   * Reloads appointments after a mutation.
   * @returns {Promise<void>}
   * @sideEffects Requests API data and updates state.
   */
  async function reloadAppointments() {
    if (!selectedProfileId) {
      return;
    }

    const result =
      await doctorAppointmentService.listAppointments(
        selectedProfileId,
      );
    setAppointments(result.appointments || []);
  }

  /**
   * Updates a form value and clears its field error.
   * @param {import("react").ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>} event - Changed field.
   * @returns {void}
   * @sideEffects Updates component state.
   */
  function handleChange(event) {
    const fieldName = event.target.name;
    const fieldValue = event.target.value;

    setForm((currentForm) => ({
      ...currentForm,
      [fieldName]: fieldValue,
    }));
    setFormErrors((currentErrors) => ({
      ...currentErrors,
      [fieldName]: "",
    }));
  }

  /**
   * Changes the active elderly profile.
   * @param {import("react").ChangeEvent<HTMLSelectElement>} event - Profile selection.
   * @returns {void}
   * @sideEffects Updates profile and form state.
   */
  function handleProfileChange(event) {
    const profileId = event.target.value;

    setSelectedProfileId(profileId);
    setForm((currentForm) => ({
      ...currentForm,
      elderlyId: profileId,
    }));
  }

  /**
   * Opens the scheduling dialog.
   * @returns {void}
   * @sideEffects Updates modal and form state.
   */
  function openModal() {
    if (!selectedProfileId) {
      showToast(
        "Create an elderly profile before scheduling a visit.",
        "info",
      );
      return;
    }

    setForm({
      ...EMPTY_FORM,
      elderlyId: selectedProfileId,
    });
    setFormErrors({});
    setIsModalOpen(true);
  }

  /**
   * Closes and resets the scheduling dialog.
   * @returns {void}
   * @sideEffects Updates modal and form state.
   */
  function closeModal() {
    if (isSubmitting) {
      return;
    }

    setIsModalOpen(false);
    setFormErrors({});
  }

  /**
   * Validates and creates an appointment.
   * @param {import("react").FormEvent<HTMLFormElement>} event - Form event.
   * @returns {Promise<void>}
   * @sideEffects Creates an appointment and may synchronize Calendar.
   */
  async function handleSubmit(event) {
    event.preventDefault();
    const errors = {};

    if (!form.elderlyId) {
      errors.elderlyId = "Please select an elderly profile.";
    }
    if (!form.doctorName.trim()) {
      errors.doctorName = "Doctor name is required.";
    }
    if (!form.specialty.trim()) {
      errors.specialty = "Specialty is required.";
    }
    if (!form.clinicName.trim()) {
      errors.clinicName = "Clinic name is required.";
    }
    if (!form.clinicAddress.trim()) {
      errors.clinicAddress = "Clinic address is required.";
    }
    if (!form.contactPhone.trim()) {
      errors.contactPhone = "Contact phone is required.";
    }
    if (!form.appointmentDate) {
      errors.appointmentDate = "Appointment date is required.";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      const result =
        await doctorAppointmentService.createAppointment({
          ...form,
          caregiverUserId:
            form.caregiverUserId || undefined,
        });

      if (form.elderlyId === selectedProfileId) {
        await reloadAppointments();
      } else {
        setSelectedProfileId(form.elderlyId);
      }

      setIsModalOpen(false);

      if (result.calendarSync?.status === "synced") {
        showToast(
          "Appointment saved and added to Google Calendar.",
          "success",
        );
      } else if (result.calendarSync?.status === "failed") {
        showToast(
          "Appointment saved. Google Calendar needs configuration attention.",
          "info",
        );
      } else {
        showToast(
          "Appointment saved in ProbashiCare.",
          "success",
        );
      }
    } catch (error) {
      const normalizedError = normalizeApiError(error);

      setFormErrors({
        form: normalizedError.message,
      });
      showToast(normalizedError.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  /**
   * Changes an appointment status.
   * @param {string} appointmentId - Appointment identifier.
   * @param {"completed"|"cancelled"} nextStatus - New status.
   * @returns {Promise<void>}
   * @sideEffects Updates through the API and reloads data.
   */
  async function handleStatusChange(
    appointmentId,
    nextStatus,
  ) {
    try {
      setBusyAppointmentId(appointmentId);
      await doctorAppointmentService.updateStatus(
        appointmentId,
        nextStatus,
      );
      await reloadAppointments();
      showToast(
        `Appointment marked as ${nextStatus}.`,
        "success",
      );
    } catch (error) {
      showToast(normalizeApiError(error).message, "error");
    } finally {
      setBusyAppointmentId("");
    }
  }

  /**
   * Confirms and removes an appointment.
   * @param {string} appointmentId - Appointment identifier.
   * @returns {Promise<void>}
   * @sideEffects Shows confirmation, deletes, and reloads data.
   */
  async function handleDelete(appointmentId) {
    const shouldDelete = window.confirm(
      "Remove this appointment from the family history?",
    );

    if (!shouldDelete) {
      return;
    }

    try {
      setBusyAppointmentId(appointmentId);
      await doctorAppointmentService.removeAppointment(
        appointmentId,
      );
      await reloadAppointments();
      showToast("Appointment removed.", "success");
    } catch (error) {
      showToast(normalizeApiError(error).message, "error");
    } finally {
      setBusyAppointmentId("");
    }
  }

  return (
    <main>
      <AppHeader />
      <div className="feature-page doctor-page">
        <section className="doctor-hero">
          <div className="doctor-hero__content">
            <span className="doctor-hero__icon" aria-hidden="true">
              <StethoscopeIcon size={24} />
            </span>
            <div>
              <span className="eyebrow">
                Medical coordination
              </span>
              <h1>Doctor visits, clearly organized.</h1>
              <p>
                Keep appointments, clinic information, and
                caregiver escort details in one family space.
              </p>
            </div>
          </div>
          <Button
            onClick={openModal}
            disabled={profiles.length === 0}
          >
            <PlusIcon size={18} />
            Schedule visit
          </Button>
          <div className="doctor-hero__metrics">
            <div>
              <strong>{upcomingAppointments.length}</strong>
              <span>Upcoming</span>
            </div>
            <div>
              <strong>{appointmentHistory.length}</strong>
              <span>In history</span>
            </div>
            <div>
              <strong>{caregivers.length}</strong>
              <span>Available escorts</span>
            </div>
          </div>
        </section>

        <section className="doctor-toolbar">
          <div>
            <span
              className="doctor-toolbar__icon"
              aria-hidden="true"
            >
              <UserIcon size={18} />
            </span>
            <div>
              <strong>Care recipient</strong>
              <small>Authorized elderly profile</small>
            </div>
          </div>
          {profiles.length > 0 ? (
            <label className="doctor-profile-select">
              <span className="sr-only">
                Select elderly profile
              </span>
              <select
                className="input"
                value={selectedProfileId}
                onChange={handleProfileChange}
              >
                {profiles.map((profile) => (
                  <option key={profile._id} value={profile._id}>
                    {getProfileName(profile)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="doctor-toolbar__empty">
              No active profiles
            </span>
          )}
        </section>

        <Card className="doctor-workspace">
          <div className="doctor-tabs">
            <div
              className="doctor-tabs__list"
              role="tablist"
              aria-label="Doctor appointment views"
            >
              <button
                type="button"
                role="tab"
                aria-selected={selectedTab === "upcoming"}
                className={
                  selectedTab === "upcoming"
                    ? "doctor-tab doctor-tab--active"
                    : "doctor-tab"
                }
                onClick={() => setSelectedTab("upcoming")}
              >
                Upcoming
                <span>{upcomingAppointments.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={selectedTab === "history"}
                className={
                  selectedTab === "history"
                    ? "doctor-tab doctor-tab--active"
                    : "doctor-tab"
                }
                onClick={() => setSelectedTab("history")}
              >
                History
                <span>{appointmentHistory.length}</span>
              </button>
            </div>
            <p>Visits for the selected care recipient</p>
          </div>

          {isLoading ? (
            <div className="doctor-loading" role="status">
              <span className="spinner" />
              Loading appointments...
            </div>
          ) : visibleAppointments.length === 0 ? (
            <div className="doctor-empty">
              <span aria-hidden="true">
                <CalendarIcon size={26} />
              </span>
              <h2>
                {selectedTab === "upcoming"
                  ? "No upcoming visits"
                  : "No appointment history"}
              </h2>
              <p>
                {selectedTab === "upcoming"
                  ? "Schedule a visit after confirming a date with the doctor."
                  : "Completed, cancelled, declined, and past visits remain here."}
              </p>
              {selectedTab === "upcoming"
                && profiles.length > 0 && (
                  <Button
                    variant="secondary"
                    onClick={openModal}
                  >
                    <PlusIcon size={17} />
                    Add first appointment
                  </Button>
                )}
            </div>
          ) : (
            <div className="doctor-card-list">
              {visibleAppointments.map((appointment) => (
                <AppointmentCard
                  key={appointment._id}
                  appointment={appointment}
                  isBusy={
                    busyAppointmentId === appointment._id
                  }
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      <Modal
        isOpen={isModalOpen}
        title="Schedule a doctor visit"
        onClose={closeModal}
        className="doctor-modal"
      >
        <form onSubmit={handleSubmit}>
          <p className="doctor-modal__intro">
            Add confirmed clinic details and optionally assign
            an approved caregiver as escort.
          </p>

          <div className="doctor-form-section">
            <div className="doctor-form-section__heading">
              <span>1</span>
              <div>
                <strong>Care recipient and escort</strong>
                <small>Choose who the visit is for</small>
              </div>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Elderly profile</span>
                <select
                  className={
                    formErrors.elderlyId
                      ? "input input--error"
                      : "input"
                  }
                  name="elderlyId"
                  value={form.elderlyId}
                  onChange={handleChange}
                >
                  <option value="">Select a profile</option>
                  {profiles.map((profile) => (
                    <option
                      key={profile._id}
                      value={profile._id}
                    >
                      {getProfileName(profile)}
                    </option>
                  ))}
                </select>
                {formErrors.elderlyId && (
                  <small className="field__error">
                    {formErrors.elderlyId}
                  </small>
                )}
              </label>
              <label className="field">
                <span>Escort caregiver (optional)</span>
                <select
                  className="input"
                  name="caregiverUserId"
                  value={form.caregiverUserId}
                  onChange={handleChange}
                >
                  <option value="">No escort assigned</option>
                  {caregivers.map((caregiver) => (
                    <option
                      key={caregiver._id}
                      value={caregiver._id}
                    >
                      {caregiver.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="doctor-form-section">
            <div className="doctor-form-section__heading">
              <span>2</span>
              <div>
                <strong>Doctor and clinic details</strong>
                <small>Record the confirmed appointment</small>
              </div>
            </div>
            <div className="form-grid">
              <Input id="doctorName" name="doctorName" label="Doctor name" value={form.doctorName} error={formErrors.doctorName} onChange={handleChange} required />
              <Input id="specialty" name="specialty" label="Specialty or department" value={form.specialty} error={formErrors.specialty} onChange={handleChange} required />
              <Input id="clinicName" name="clinicName" label="Clinic or hospital" value={form.clinicName} error={formErrors.clinicName} onChange={handleChange} required />
              <Input id="contactPhone" name="contactPhone" label="Clinic contact" value={form.contactPhone} error={formErrors.contactPhone} onChange={handleChange} required />
              <Input id="clinicAddress" name="clinicAddress" label="Clinic address" value={form.clinicAddress} error={formErrors.clinicAddress} onChange={handleChange} required />
              <Input id="appointmentDate" name="appointmentDate" type="datetime-local" label="Date and time" value={form.appointmentDate} error={formErrors.appointmentDate} onChange={handleChange} required />
            </div>
          </div>

          <label className="field">
            <span>Preparation notes (optional)</span>
            <textarea
              className="input doctor-notes-input"
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={4}
              placeholder="Mobility support, medicine, documents, or transport"
            />
          </label>

          <div className="doctor-calendar-note">
            <CalendarIcon size={18} />
            <p>
              ProbashiCare always saves the visit. Google
              Calendar is updated only when its shared
              calendar is configured correctly.
            </p>
          </div>

          {formErrors.form && (
            <div className="alert alert--error" role="alert">
              {formErrors.form}
            </div>
          )}

          <div className="modal-actions">
            <Button
              type="button"
              variant="ghost"
              disabled={isSubmitting}
              onClick={closeModal}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Save appointment
            </Button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
