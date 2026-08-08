import { api } from "./api.js";

async function createBooking(payload) {
  const response = await api.post("/bookings", payload);
  return response.data.data;
}

async function listMyBookings() {
  const response = await api.get("/bookings");
  return response.data.data;
}

async function cancelBooking(bookingId, reason = "") {
  const response = await api.patch(`/bookings/${bookingId}/cancel`, { reason });
  return response.data.data;
}

async function listCaregiverBookings() {
  const response = await api.get("/caregivers/bookings/mine");
  return response.data.data;
}

async function reviewBooking(bookingId, status, reason = "") {
  const response = await api.patch(`/caregivers/bookings/${bookingId}/status`, { status, reason });
  return response.data.data;
}

export const bookingService = {
  createBooking,
  listMyBookings,
  cancelBooking,
  listCaregiverBookings,
  reviewBooking,
};
