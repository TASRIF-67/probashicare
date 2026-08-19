import { useEffect, useState } from "react";
import { CaregiverHeader } from "../caregiver/CaregiverHeader.jsx";
import { Button } from "../Button.jsx";
import { Card } from "../Card.jsx";
import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  MapPinIcon,
  PhoneIcon,
  StethoscopeIcon,
} from "../Icons.jsx";
import { doctorAppointmentService } from "../../services/doctorAppointmentService.js";
import { normalizeApiError } from "../../services/api.js";
import { useToast } from "../../context/ToastContext.jsx";

/**
 * Formats an appointment date for the caregiver's locale.
 * @param {string|Date} value - Stored date.
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
 * Returns a caregiver-facing appointment status.
 * @param {string} status - Stored status.
 * @returns {string} Human-readable status.
 * @sideEffects None.
 */
function getStatusLabel(status) {
  if (status === "completed") {
    return "Completed";
  }

  if (status === "cancelled") {
    return "Cancelled by family";
  }

  if (status === "rejected") {
    return "Declined";
  }

  return "Scheduled";
}

/**
 * Checks whether a scheduled appointment has not passed.
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
 * Renders assigned doctor visits for an approved caregiver.
 * @param {void} _unused - This component accepts no props.
 * @returns {import("react").ReactElement} Caregiver visit schedule and history.
 * @sideEffects Loads and updates assigned appointments through authenticated APIs.
 */
export function CaregiverDoctorVisits() {
  const { showToast } = useToast();
  const [appointments, setAppointments] = useState([]);
  const [selectedTab, setSelectedTab] = useState("upcoming");
  const [isLoading, setIsLoading] = useState(true);
  const [busyAppointmentId, setBusyAppointmentId] = useState("");
  const [decliningAppointmentId, setDecliningAppointmentId] =
    useState("");
  const [rejectionReason, setRejectionReason] = useState("");

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

  /**
   * Loads visits assigned to the signed-in caregiver.
   * @returns {Promise<void>}
   * @sideEffects Requests API data and updates state.
   */
  async function loadVisits() {
    try {
      setIsLoading(true);
      const result =
        await doctorAppointmentService.listAppointments();
      const assignedAppointments = [];

      for (const appointment of result.appointments || []) {
        if (appointment.caregiverUserId) {
          assignedAppointments.push(appointment);
        }
      }

      setAppointments(assignedAppointments);
    } catch (error) {
      showToast(normalizeApiError(error).message, "error");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadVisits();
  }, []);

  /**
   * Marks one escort visit as completed.
   * @param {string} appointmentId - Appointment identifier.
   * @returns {Promise<void>}
   * @sideEffects Updates through the API and reloads data.
   */
  async function markComplete(appointmentId) {
    try {
      setBusyAppointmentId(appointmentId);
      await doctorAppointmentService.updateStatus(
        appointmentId,
        "completed",
      );
      await loadVisits();
      showToast(
        "Escort duty marked as completed.",
        "success",
      );
    } catch (error) {
      showToast(normalizeApiError(error).message, "error");
    } finally {
      setBusyAppointmentId("");
    }
  }

  /**
   * Opens a decline form for one visit.
   * @param {string} appointmentId - Appointment identifier.
   * @returns {void}
   * @sideEffects Updates decline-form state.
   */
  function beginDecline(appointmentId) {
    setDecliningAppointmentId(appointmentId);
    setRejectionReason("");
  }

  /**
   * Closes and resets the decline form.
   * @returns {void}
   * @sideEffects Updates decline-form state.
   */
  function cancelDecline() {
    setDecliningAppointmentId("");
    setRejectionReason("");
  }

  /**
   * Declines an escort assignment with a required reason.
   * @param {string} appointmentId - Appointment identifier.
   * @returns {Promise<void>}
   * @sideEffects Updates through the API and reloads data.
   */
  async function rejectVisit(appointmentId) {
    const trimmedReason = rejectionReason.trim();

    if (!trimmedReason) {
      showToast(
        "Please tell the family why you cannot join.",
        "error",
      );
      return;
    }

    try {
      setBusyAppointmentId(appointmentId);
      await doctorAppointmentService.updateStatus(
        appointmentId,
        "rejected",
        trimmedReason,
      );
      cancelDecline();
      await loadVisits();
      showToast(
        "The family can now see your response.",
        "success",
      );
    } catch (error) {
      showToast(normalizeApiError(error).message, "error");
    } finally {
      setBusyAppointmentId("");
    }
  }

  return (
    <main>
      <CaregiverHeader />
      <div className="feature-page doctor-page caregiver-doctor-page">
        <section className="doctor-hero">
          <div className="doctor-hero__content">
            <span className="doctor-hero__icon" aria-hidden="true">
              <StethoscopeIcon size={24} />
            </span>
            <div>
              <span className="eyebrow">Escort schedule</span>
              <h1>Doctor visits assigned to you.</h1>
              <p>
                Review clinic details, prepare for each visit,
                and keep the family informed.
              </p>
            </div>
          </div>
          <div className="doctor-hero__metrics">
            <div>
              <strong>{upcomingAppointments.length}</strong>
              <span>Upcoming</span>
            </div>
            <div>
              <strong>{appointmentHistory.length}</strong>
              <span>In history</span>
            </div>
          </div>
        </section>

        <Card className="doctor-workspace">
          <div className="doctor-tabs">
            <div
              className="doctor-tabs__list"
              role="tablist"
              aria-label="Assigned doctor visit views"
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
            <p>Only visits assigned to your account</p>
          </div>

          {isLoading ? (
            <div className="doctor-loading" role="status">
              <span className="spinner" />
              Loading assigned visits...
            </div>
          ) : visibleAppointments.length === 0 ? (
            <div className="doctor-empty">
              <span aria-hidden="true">
                <CalendarIcon size={26} />
              </span>
              <h2>
                {selectedTab === "upcoming"
                  ? "No upcoming escort visits"
                  : "No visit history"}
              </h2>
              <p>
                {selectedTab === "upcoming"
                  ? "New visits appear after a family assigns you."
                  : "Completed, cancelled, declined, and past visits remain here."}
              </p>
            </div>
          ) : (
            <div className="doctor-card-list">
              {visibleAppointments.map((appointment) => {
                const isBusy =
                  busyAppointmentId === appointment._id;
                const isDeclining =
                  decliningAppointmentId === appointment._id;

                return (
                  <article
                    className="doctor-visit-card"
                    key={appointment._id}
                  >
                    <div className="doctor-visit-card__date">
                      <ClockIcon size={18} />
                      <strong>
                        {formatDateTime(
                          appointment.appointmentDate,
                        )}
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
                    </div>

                    {appointment.notes && (
                      <p className="doctor-visit-card__notes">
                        <strong>Preparation:</strong>{" "}
                        {appointment.notes}
                      </p>
                    )}

                    {appointment.status === "rejected"
                      && appointment.statusReason && (
                        <div className="doctor-response">
                          <strong>Your response</strong>
                          <p>{appointment.statusReason}</p>
                        </div>
                      )}

                    {isDeclining ? (
                      <div className="doctor-decline-form">
                        <label className="field">
                          <span>
                            Why are you unable to join?
                          </span>
                          <textarea
                            className="input"
                            rows={3}
                            value={rejectionReason}
                            onChange={(event) =>
                              setRejectionReason(
                                event.target.value,
                              )
                            }
                            placeholder="Give the family a short reason"
                          />
                        </label>
                        <div>
                          <Button
                            variant="ghost"
                            disabled={isBusy}
                            onClick={cancelDecline}
                          >
                            Keep assignment
                          </Button>
                          <Button
                            disabled={isBusy}
                            onClick={() =>
                              rejectVisit(appointment._id)
                            }
                          >
                            Send response
                          </Button>
                        </div>
                      </div>
                    ) : (
                      appointment.status === "scheduled" && (
                        <div className="doctor-visit-card__actions">
                          <Button
                            disabled={isBusy}
                            onClick={() =>
                              markComplete(appointment._id)
                            }
                          >
                            <CheckIcon size={16} />
                            Mark completed
                          </Button>
                          <Button
                            variant="ghost"
                            disabled={isBusy}
                            onClick={() =>
                              beginDecline(appointment._id)
                            }
                          >
                            I cannot attend
                          </Button>
                        </div>
                      )
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
