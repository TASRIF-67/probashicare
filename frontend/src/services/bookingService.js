import { api } from "./api.js";

async function createBooking(payload) {
  const response = await api.post("/bookings", payload);
  return response.data.data;
}

async function listMyBookings() {
  const response = await api.get("/bookings/my-bookings");
  return response.data.data;
}

export const bookingService = {
  createBooking,
  listMyBookings,
};
