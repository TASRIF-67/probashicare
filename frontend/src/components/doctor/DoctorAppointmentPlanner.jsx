import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "../AppHeader.jsx";
import { Button } from "../Button.jsx";
import { Card } from "../Card.jsx";
import { Input } from "../Input.jsx";
import { Modal } from "../Modal.jsx";
import { CalendarIcon, CheckIcon, ClockIcon, MapPinIcon, PhoneIcon, PlusIcon, StethoscopeIcon, TrashIcon } from "../Icons.jsx";
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

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown date"
    : date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function formatStatus(status) {
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  if (status === "rejected") return "Rejected";
  return "Scheduled";
}

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
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});

  const activeAppointments = useMemo(() => {
    const currentTime = Date.now();

    if (selectedTab === "upcoming") {
      return appointments.filter((appointment) => {
        const appointmentTime = new Date(appointment.appointmentDate).getTime();
        const hasUpcomingStatus = ["scheduled", "rejected"].includes(
          appointment.status,
        );
        const hasNotPassed = appointmentTime >= currentTime;

        return hasUpcomingStatus && hasNotPassed;
      });
    }

    return appointments.filter((appointment) => {
      const appointmentTime = new Date(appointment.appointmentDate).getTime();
      const hasUpcomingStatus = ["scheduled", "rejected"].includes(
        appointment.status,
      );
      const hasNotPassed = appointmentTime >= currentTime;

      return !hasUpcomingStatus || !hasNotPassed;
    });
  }, [appointments, selectedTab]);

  async function loadProfiles() {
    const result = await elderlyProfileService.listProfiles("active");
    const nextProfiles = result.profiles || [];
    setProfiles(nextProfiles);

    if (nextProfiles.length > 0) {
      setSelectedProfileId((current) => current || nextProfiles[0]._id);
      setForm((current) => ({ ...current, elderlyId: current.elderlyId || nextProfiles[0]._id }));
    }
  }

  async function loadCaregivers() {
    const result = await caregiverService.listCaregivers();
    setCaregivers(result.caregivers || []);
  }

  async function loadAppointments(profileId = selectedProfileId) {
    if (!profileId) {
      setAppointments([]);
      return;
    }
    const result = await doctorAppointmentService.listAppointments(profileId);
    setAppointments(result.appointments || []);
  }

  useEffect(() => {
    let isCancelled = false;

    async function initialize() {
      try {
        setIsLoading(true);
        const [profileResult, caregiverResult] = await Promise.all([
          elderlyProfileService.listProfiles("active"),
          caregiverService.listCaregivers(),
        ]);
        if (isCancelled) return;

        const nextProfiles = profileResult.profiles || [];
        setProfiles(nextProfiles);
        setCaregivers(caregiverResult.caregivers || []);

        if (nextProfiles.length > 0) {
          const firstProfileId = nextProfiles[0]._id;
          setSelectedProfileId(firstProfileId);
          setForm((current) => ({ ...current, elderlyId: firstProfileId }));
          const appointmentResult = await doctorAppointmentService.listAppointments(firstProfileId);
          setAppointments(appointmentResult.appointments || []);
        }
      } catch (error) {
        if (isCancelled) return;
        showToast(normalizeApiError(error).message, "error");
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    initialize();
    return () => {
      isCancelled = true;
    };
  }, [showToast]);

  useEffect(() => {
    if (!selectedProfileId) return;
    doctorAppointmentService.listAppointments(selectedProfileId)
      .then((result) => setAppointments(result.appointments || []))
      .catch((error) => showToast(normalizeApiError(error).message, "error"));
  }, [selectedProfileId, showToast]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFormErrors((current) => ({ ...current, [name]: "" }));
  }

  function openModal() {
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setForm({ ...EMPTY_FORM, elderlyId: selectedProfileId || "" });
    setFormErrors({});
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const errors = {};

    if (!form.elderlyId) errors.elderlyId = "Please select an elderly profile.";
    if (!form.doctorName) errors.doctorName = "Doctor name is required.";
    if (!form.specialty) errors.specialty = "Specialty is required.";
    if (!form.clinicName) errors.clinicName = "Clinic name is required.";
    if (!form.clinicAddress) errors.clinicAddress = "Clinic address is required.";
    if (!form.contactPhone) errors.contactPhone = "Contact phone is required.";
    if (!form.appointmentDate) errors.appointmentDate = "Appointment date is required.";

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      await doctorAppointmentService.createAppointment({
        ...form,
        caregiverUserId: form.caregiverUserId || undefined,
      });
      await loadAppointments(selectedProfileId || form.elderlyId);
      showToast("Doctor appointment scheduled successfully.", "success");
      closeModal();
    } catch (error) {
      const normalized = normalizeApiError(error);
      setFormErrors({ form: normalized.message });
      showToast(normalized.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStatusChange(id, nextStatus) {
    try {
      await doctorAppointmentService.updateStatus(id, nextStatus);
      if (selectedProfileId) {
        await loadAppointments(selectedProfileId);
      }
      showToast(`Appointment marked as ${nextStatus}.`, "success");
    } catch (error) {
      showToast(normalizeApiError(error).message, "error");
    }
  }

  async function handleDelete(id) {
    try {
      await doctorAppointmentService.removeAppointment(id);
      if (selectedProfileId) {
        await loadAppointments(selectedProfileId);
      }
      showToast("Appointment removed.", "success");
    } catch (error) {
      showToast(normalizeApiError(error).message, "error");
    }
  }

  return (
    <main>
      <AppHeader />
      <div className="feature-page">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Medical coordination</span>
            <h1>Doctor appointment planner</h1>
          </div>
          <Button onClick={openModal}>
            <PlusIcon size={18} /> Add appointment
          </Button>
        </div>

        {profiles.length > 0 && (
          <div className="form-grid" style={{ marginBottom: "1rem" }}>
            <label className="field">
              <span>Elderly profile</span>
              <select
                className="input"
                value={selectedProfileId}
                onChange={(event) => setSelectedProfileId(event.target.value)}
              >
                {profiles.map((profile) => (
                  <option key={profile._id} value={profile._id}>
                    {profile.personalInformation?.fullName || profile.name || "Elderly profile"}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <Card className="doctor-appointment-tabs">
          <div className="tab-list" role="tablist" aria-label="Doctor appointment views">
            <button
              type="button"
              className={selectedTab === "upcoming" ? "tab is-active" : "tab"}
              onClick={() => setSelectedTab("upcoming")}
            >
              Upcoming appointments
            </button>
            <button
              type="button"
              className={selectedTab === "history" ? "tab is-active" : "tab"}
              onClick={() => setSelectedTab("history")}
            >
              Appointment history
            </button>
          </div>

          {isLoading ? (
            <p>Loading appointments…</p>
          ) : activeAppointments.length === 0 ? (
            <div className="empty-state">
              <CalendarIcon size={28} />
              <h3>No appointments here yet</h3>
              <p>
                {selectedTab === "upcoming"
                  ? "Create an external doctor visit and assign an escort whenever needed."
                  : "Completed and cancelled visits remain here for reference."}
              </p>
            </div>
          ) : (
            <div className="stack-list">
              {activeAppointments.map((appointment) => (
                <article className="appointment-card" key={appointment._id}>
                  <div className="appointment-card__header">
                    <div>
                      <h3>{appointment.doctorName}</h3>
                      <p>{appointment.specialty}</p>
                    </div>
                    <span className={`status-badge status-badge--${appointment.status}`}>
                      {formatStatus(appointment.status)}
                    </span>
                  </div>

                  <div className="appointment-card__meta">
                    <span><StethoscopeIcon size={15} /> {appointment.clinicName}</span>
                    <span><MapPinIcon size={15} /> {appointment.clinicAddress}</span>
                    <span><PhoneIcon size={15} /> {appointment.contactPhone}</span>
                    <span><ClockIcon size={15} /> {formatDateTime(appointment.appointmentDate)}</span>
                  </div>

                  {appointment.notes && <p className="text-muted">Preparation notes: {appointment.notes}</p>}

                  {appointment.caregiverUserId && (
                    <p className="text-muted">
                      Escort: {appointment.caregiverUserId.name || appointment.caregiverUserId.email || "Assigned caregiver"}
                    </p>
                  )}

                  {appointment.status === "rejected" && appointment.statusReason && (
                    <div className="alert alert--error" role="alert">
                      Caregiver response: {appointment.statusReason}
                    </div>
                  )}

                  <div className="appointment-card__actions">
                    {(["scheduled", "rejected"]).includes(appointment.status) && (
                      <>
                        <Button variant="secondary" onClick={() => handleStatusChange(appointment._id, "completed")}>
                          <CheckIcon size={16} /> Mark completed
                        </Button>
                        <Button variant="ghost" onClick={() => handleStatusChange(appointment._id, "cancelled")}>
                          Cancel
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" onClick={() => handleDelete(appointment._id)}>
                      <TrashIcon size={16} /> Delete
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Modal isOpen={isModalOpen} title="Schedule doctor appointment" onClose={closeModal} className="modal--booking">
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="field">
              <span>Elderly profile</span>
              <select
                className={formErrors.elderlyId ? "input input--error" : "input"}
                name="elderlyId"
                value={form.elderlyId}
                onChange={handleChange}
              >
                <option value="">Select an elderly profile</option>
                {profiles.map((profile) => (
                  <option key={profile._id} value={profile._id}>
                    {profile.personalInformation?.fullName || profile.name || "Elderly profile"}
                  </option>
                ))}
              </select>
              {formErrors.elderlyId && <small className="field__error">{formErrors.elderlyId}</small>}
            </label>

            <Input id="doctorName" name="doctorName" label="Doctor name" value={form.doctorName} error={formErrors.doctorName} onChange={handleChange} required />
            <Input id="specialty" name="specialty" label="Specialty / department" value={form.specialty} error={formErrors.specialty} onChange={handleChange} required />
            <Input id="clinicName" name="clinicName" label="Clinic / hospital name" value={form.clinicName} error={formErrors.clinicName} onChange={handleChange} required />
            <Input id="clinicAddress" name="clinicAddress" label="Clinic address" value={form.clinicAddress} error={formErrors.clinicAddress} onChange={handleChange} required />
            <Input id="contactPhone" name="contactPhone" label="Contact phone" value={form.contactPhone} error={formErrors.contactPhone} onChange={handleChange} required />
            <label className="field">
              <span>Escort caregiver (optional)</span>
              <select
                className={formErrors.caregiverUserId ? "input input--error" : "input"}
                name="caregiverUserId"
                value={form.caregiverUserId}
                onChange={handleChange}
              >
                <option value="">No escort assigned</option>
                {caregivers.map((caregiver) => (
                  <option key={caregiver._id} value={caregiver._id}>
                    {caregiver.name}
                  </option>
                ))}
              </select>
              {formErrors.caregiverUserId && <small className="field__error">{formErrors.caregiverUserId}</small>}
            </label>
            <Input
              id="appointmentDate"
              name="appointmentDate"
              type="datetime-local"
              label="Appointment date & time"
              value={form.appointmentDate}
              error={formErrors.appointmentDate}
              onChange={handleChange}
              required
            />
            <label className="field field--full">
              <span>Preparation notes</span>
              <textarea
                className={formErrors.notes ? "input input--error" : "input"}
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={4}
                placeholder="Mobility needs, medication reminders, transfer details, or instructions..."
              />
            </label>
          </div>

          {formErrors.form && (
            <div className="alert alert--error" role="alert">
              {formErrors.form}
            </div>
          )}

          <div className="modal-actions">
            <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting}>Save appointment</Button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
