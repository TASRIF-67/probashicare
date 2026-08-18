import { api } from "./api.js";

/**
 * Creates a doctor appointment and returns its Calendar synchronization result.
 * @param {object} payload - Appointment form values.
 * @returns {Promise<{appointment: object, calendarSync: {status: string, message: string}}>} Created record and optional Calendar outcome.
 * @sideEffects Sends an authenticated POST request.
 */
async function createAppointment(payload) {
  const response = await api.post("/doctor-appointments", payload);
  return response.data.data;
}

/**
 * Lists doctor appointments visible to the current user.
 * @param {string} [elderlyId=""] - Optional elderly-profile filter.
 * @returns {Promise<{appointments: object[], upcoming: object[], history: object[], count: number}>} Appointment collections.
 * @sideEffects Sends an authenticated GET request.
 */
async function listAppointments(elderlyId = "") {
  const response = await api.get("/doctor-appointments", {
    params: elderlyId ? { elderlyId } : {},
  });
  return response.data.data;
}

/**
 * Applies a permitted status transition.
 * @param {string} id - Appointment identifier.
 * @param {"completed"|"cancelled"|"rejected"} status - New status.
 * @param {string} [reason=""] - Required caregiver reason for rejection.
 * @returns {Promise<object>} Updated appointment.
 * @sideEffects Sends an authenticated PATCH request.
 */
async function updateStatus(id, status, reason = "") {
  const payload = {
    status,
  };

  if (reason) {
    payload.reason = reason;
  }

  const response = await api.patch(`/doctor-appointments/${id}/status`, payload);
  return response.data.data.appointment;
}

/**
 * Permanently removes an appointment owned by the current family.
 * @param {string} id - Appointment identifier.
 * @returns {Promise<{deletedAppointmentId: string, calendarSync: object|null}>} Deletion result.
 * @sideEffects Sends an authenticated DELETE request.
 */
async function removeAppointment(id) {
  const response = await api.delete(`/doctor-appointments/${id}`);
  return response.data.data;
}

export const doctorAppointmentService = {
  createAppointment,
  listAppointments,
  updateStatus,
  removeAppointment,
};
