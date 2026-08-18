import { api } from "./api.js";

async function createAppointment(payload) {
  const response = await api.post("/doctor-appointments", payload);
  return response.data.data.appointment;
}

async function listAppointments(elderlyId = "") {
  const response = await api.get("/doctor-appointments", {
    params: elderlyId ? { elderlyId } : {},
  });
  return response.data.data;
}

async function updateStatus(id, status, reason = "") {
  const payload = { status };
  if (reason) payload.reason = reason;
  const response = await api.patch(`/doctor-appointments/${id}/status`, payload);
  return response.data.data.appointment;
}

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
