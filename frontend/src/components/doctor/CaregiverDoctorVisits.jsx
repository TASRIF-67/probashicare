import { useEffect, useState } from "react";
import { CaregiverHeader } from "../caregiver/CaregiverHeader.jsx";
import { Card } from "../Card.jsx";
import { Button } from "../Button.jsx";
import { CalendarIcon, ClockIcon, MapPinIcon, PhoneIcon, StethoscopeIcon, CheckIcon } from "../Icons.jsx";
import { doctorAppointmentService } from "../../services/doctorAppointmentService.js";
import { normalizeApiError } from "../../services/api.js";
import { useToast } from "../../context/ToastContext.jsx";

const EMPTY_REJECTION = {};

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown date"
    : date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

export function CaregiverDoctorVisits() {
  const { showToast } = useToast();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectReasons, setRejectReasons] = useState(EMPTY_REJECTION);

  async function loadVisits() {
    try {
      setLoading(true);
      const result = await doctorAppointmentService.listAppointments();
      setAppointments((result.appointments || []).filter((item) => item.caregiverUserId));
    } catch (error) {
      showToast(normalizeApiError(error).message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVisits();
  }, []);

  async function markComplete(appointmentId) {
    try {
      await doctorAppointmentService.updateStatus(appointmentId, "completed");
      await loadVisits();
      showToast("Escort duty marked as completed.", "success");
    } catch (error) {
      showToast(normalizeApiError(error).message, "error");
    }
  }

  async function rejectVisit(appointmentId) {
    const reason = (rejectReasons[appointmentId] || "").trim();

    if (!reason) {
      showToast("Please tell the family why you cannot join.", "error");
      return;
    }

    try {
      await doctorAppointmentService.updateStatus(appointmentId, "rejected", reason);
      setRejectReasons((current) => ({ ...current, [appointmentId]: "" }));
      await loadVisits();
      showToast("Appointment rejected and reason sent to family.", "success");
    } catch (error) {
      showToast(normalizeApiError(error).message, "error");
    }
  }

  return (
    <main>
      <CaregiverHeader />
      <div className="feature-page">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Escort schedule</span>
            <h1>Doctor visits assigned to me</h1>
          </div>
        </div>

        <Card>
          {loading ? (
            <p>Loading assigned visits…</p>
          ) : appointments.length === 0 ? (
            <div className="empty-state">
              <CalendarIcon size={28} />
              <h3>No assigned doctor visits</h3>
              <p>Upcoming appointments that require your escort support will appear here.</p>
            </div>
          ) : (
            <div className="stack-list">
              {appointments.map((appointment) => (
                <article className="appointment-card" key={appointment._id}>
                  <div className="appointment-card__header">
                    <div>
                      <h3>{appointment.doctorName}</h3>
                      <p>{appointment.specialty}</p>
                    </div>
                    <span className={`status-badge status-badge--${appointment.status}`}>
                      {appointment.status === "scheduled" ? "Scheduled" : appointment.status}
                    </span>
                  </div>

                  <div className="appointment-card__meta">
                    <span><StethoscopeIcon size={15} /> {appointment.clinicName}</span>
                    <span><MapPinIcon size={15} /> {appointment.clinicAddress}</span>
                    <span><PhoneIcon size={15} /> {appointment.contactPhone}</span>
                    <span><ClockIcon size={15} /> {formatDateTime(appointment.appointmentDate)}</span>
                  </div>

                  {appointment.notes && <p className="text-muted">Preparation notes: {appointment.notes}</p>}

                  {appointment.status === "scheduled" && (
                    <div className="appointment-card__actions" style={{ display: "grid", gap: "0.75rem" }}>
                      <Button onClick={() => markComplete(appointment._id)}>
                        <CheckIcon size={16} /> Mark complete
                      </Button>

                      <label className="field" style={{ margin: 0 }}>
                        <span>Reason you cannot join</span>
                        <textarea
                          className="input"
                          rows={3}
                          value={rejectReasons[appointment._id] || ""}
                          onChange={(event) =>
                            setRejectReasons((current) => ({
                              ...current,
                              [appointment._id]: event.target.value,
                            }))
                          }
                          placeholder="Explain why you cannot attend the appointment."
                        />
                      </label>

                      <Button variant="ghost" onClick={() => rejectVisit(appointment._id)}>
                        Reject visit
                      </Button>
                    </div>
                  )}

                  {appointment.status === "rejected" && appointment.statusReason && (
                    <div className="alert alert--error" role="alert">
                      Caregiver notice: {appointment.statusReason}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
