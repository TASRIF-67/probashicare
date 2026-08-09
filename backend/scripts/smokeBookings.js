import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import app from "../app.js";
import { connectDatabase } from "../config/database.js";
import { validateEnvironment } from "../config/env.js";
import { Booking } from "../models/Booking.js";
import { BookingReservation } from "../models/BookingReservation.js";
import { CareAssignment } from "../models/CareAssignment.js";
import { CaregiverProfile } from "../models/CaregiverProfile.js";
import { ElderlyFamilyLink } from "../models/ElderlyFamilyLink.js";
import { ElderlyProfile } from "../models/ElderlyProfile.js";
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";

const marker = `booking-smoke-${Date.now()}`;
const password = "BookingSmokePassword2026";
let server;
let baseUrl;

const dateKey = (date) => date.toISOString().slice(0, 10);
const addDays = (days) => { const value = new Date(); value.setHours(12, 0, 0, 0); value.setDate(value.getDate() + days); return dateKey(value); };
const weekday = (value) => ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][new Date(`${value}T00:00:00Z`).getUTCDay()];

async function callApi(path, { method = "GET", body, cookie, expectedStatus = 200 } = {}) {
  const response = await fetch(`${baseUrl}${path}`, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const payload = await response.json();
  if (response.status !== expectedStatus) throw new Error(`${method} ${path} returned ${response.status}: ${JSON.stringify(payload)}`);
  return { status: response.status, payload, cookie: response.headers.get("set-cookie")?.split(";")[0] || cookie || "" };
}

async function createUser(role, suffix) {
  return User.create({ name: `${role} booking smoke`, email: `${marker}-${suffix}@example.test`, password: await bcrypt.hash(password, 12), role, isVerified: true });
}

async function login(user) {
  return (await callApi("/auth/login", { method: "POST", body: { email: user.email, password } })).cookie;
}

async function createElderly(family, suffix) {
  const profile = await ElderlyProfile.create({ createdBy: family._id, personalInformation: { fullName: `Smoke Elderly ${suffix}`, dateOfBirth: new Date("1950-01-01"), gender: "female", address: "Smoke address", district: "Dhaka", division: "Dhaka", familyRelationship: "parent" } });
  await ElderlyFamilyLink.create({ elderlyProfileId: profile._id, familyUserId: family._id, relationship: "parent", permission: "owner", linkedBy: family._id, status: "active" });
  return profile;
}

function payload({ caregiver, elderly, bookingType = "one-time", startDate, endDate = startDate, selectedWeekday = weekday(startDate) }) {
  return { caregiverId: caregiver._id.toString(), elderlyProfileId: elderly._id.toString(), bookingType, serviceType: "companionship", startDate, endDate, slots: [{ weekday: selectedWeekday, startTime: "00:00", endTime: "23:59" }] };
}

function assertPrivateFieldsHidden(value) {
  const serialized = JSON.stringify(value);
  if (serialized.includes("@example.test") || serialized.includes("Private caregiver phone")) throw new Error("Marketplace response exposed private caregiver contact data.");
}

async function run() {
  validateEnvironment();
  await connectDatabase();
  await Promise.all([
    Booking.syncIndexes(),
    BookingReservation.syncIndexes(),
    CareAssignment.syncIndexes(),
    Notification.syncIndexes(),
  ]);
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  const [familyA, familyB, caregiver, admin] = await Promise.all([createUser("family", "family-a"), createUser("family", "family-b"), createUser("caregiver", "caregiver"), createUser("admin", "admin")]);
  const [elderlyA, elderlyB] = await Promise.all([createElderly(familyA, "A"), createElderly(familyB, "B")]);
  await CaregiverProfile.create({ userId: caregiver._id, phone: "Private caregiver phone", bio: "Private-safe public bio", supportedServiceTypes: ["companionship"], availability: ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].map((day) => ({ day, startTime: "00:00", endTime: "23:59" })), applicationStatus: "approved" });
  const [familyACookie, familyBCookie, caregiverCookie, adminCookie] = await Promise.all([login(familyA), login(familyB), login(caregiver), login(admin)]);

  await callApi("/caregivers", { expectedStatus: 401 });
  await callApi("/caregivers", { cookie: caregiverCookie, expectedStatus: 403 });
  assertPrivateFieldsHidden((await callApi("/caregivers", { cookie: familyACookie })).payload);
  assertPrivateFieldsHidden((await callApi("/caregivers", { cookie: adminCookie })).payload);
  await callApi(`/caregivers/${caregiver._id}/availability`, { expectedStatus: 401 });
  await callApi(`/caregivers/${caregiver._id}/availability`, { cookie: caregiverCookie, expectedStatus: 403 });
  assertPrivateFieldsHidden((await callApi(`/caregivers/${caregiver._id}/availability`, { cookie: familyACookie })).payload);
  assertPrivateFieldsHidden((await callApi(`/caregivers/${caregiver._id}/availability`, { cookie: adminCookie })).payload);

  const today = addDays(0);
  const sameDay = await callApi("/bookings", { method: "POST", cookie: familyACookie, expectedStatus: 201, body: payload({ caregiver, elderly: elderlyA, startDate: today }) });
  await callApi(`/bookings/${sameDay.payload.data.booking._id}/cancel`, { method: "PATCH", cookie: familyACookie });

  await callApi("/bookings", { method: "POST", cookie: familyACookie, expectedStatus: 404, body: payload({ caregiver, elderly: elderlyB, startDate: addDays(1) }) });

  const rangeStart = addDays(2);
  const rangeEnd = addDays(3);
  const rangeDays = new Set([weekday(rangeStart), weekday(rangeEnd)]);
  const outsideDay = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].find((day) => !rangeDays.has(day));
  await callApi("/bookings", { method: "POST", cookie: familyACookie, expectedStatus: 422, body: payload({ caregiver, elderly: elderlyA, bookingType: "scheduled", startDate: rangeStart, endDate: rangeEnd, selectedWeekday: outsideDay }) });

  const concurrentDate = addDays(5);
  const concurrentPayloadA = payload({ caregiver, elderly: elderlyA, startDate: concurrentDate });
  const concurrentPayloadB = payload({ caregiver, elderly: elderlyB, startDate: concurrentDate });
  const concurrent = await Promise.all([fetch(`${baseUrl}/bookings`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: familyACookie }, body: JSON.stringify(concurrentPayloadA) }), fetch(`${baseUrl}/bookings`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: familyBCookie }, body: JSON.stringify(concurrentPayloadB) })]);
  const statuses = concurrent.map((response) => response.status).sort();
  if (statuses[0] !== 201 || statuses[1] !== 409) throw new Error(`Concurrent booking statuses were ${statuses.join(", ")} instead of 201, 409.`);
  const winnerResponse = concurrent.find((response) => response.status === 201);
  const winner = await winnerResponse.json();
  const winningFamilyCookie = winner.data.booking.elderlyProfileId === elderlyA._id.toString() ? familyACookie : familyBCookie;
  await callApi(`/bookings/${winner.data.booking._id}/cancel`, { method: "PATCH", cookie: winningFamilyCookie });

  const scheduledStart = addDays(7);
  const scheduled = await callApi("/bookings", { method: "POST", cookie: familyACookie, expectedStatus: 201, body: payload({ caregiver, elderly: elderlyA, bookingType: "scheduled", startDate: scheduledStart, endDate: addDays(20) }) });
  await callApi(`/caregivers/bookings/${scheduled.payload.data.booking._id}/status`, { method: "PATCH", cookie: caregiverCookie, body: { status: "accepted" } });
  const acceptedAssignment = await CareAssignment.findOne({
    sourceBookingId: scheduled.payload.data.booking._id,
    caregiverUserId: caregiver._id,
    elderlyProfileId: elderlyA._id,
    status: "scheduled",
  });
  if (!acceptedAssignment) {
    throw new Error("Accepted booking did not create a reportable care assignment.");
  }
  const requestNotification = await Notification.findOne({
    recipientUserId: caregiver._id,
    relatedEntityId: scheduled.payload.data.booking._id,
    type: "booking-requested",
  });
  const acceptedNotification = await Notification.findOne({
    recipientUserId: familyA._id,
    relatedEntityId: scheduled.payload.data.booking._id,
    type: "booking-accepted",
  });
  if (!requestNotification || !acceptedNotification) {
    throw new Error("Booking workflow did not create both participant notifications.");
  }

  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(0, 0, 0, 0);
  await Booking.updateOne({ _id: scheduled.payload.data.booking._id }, { $set: { startDate: yesterday, endDate: yesterday, occurrences: [{ date: yesterday, timeSlot: "00:00-00:01" }] } });
  await callApi(`/caregivers/bookings/${scheduled.payload.data.booking._id}/status`, { method: "PATCH", cookie: caregiverCookie, body: { status: "completed" } });

  const declineDate = addDays(22);
  const declined = await callApi("/bookings", { method: "POST", cookie: familyACookie, expectedStatus: 201, body: payload({ caregiver, elderly: elderlyA, startDate: declineDate }) });
  await callApi(`/caregivers/bookings/${declined.payload.data.booking._id}/status`, { method: "PATCH", cookie: caregiverCookie, body: { status: "declined", reason: "Smoke test decline" } });

  const longStart = addDays(30);
  const longTerm = await callApi("/bookings", { method: "POST", cookie: familyACookie, expectedStatus: 201, body: payload({ caregiver, elderly: elderlyA, bookingType: "long-term", startDate: longStart, endDate: addDays(65) }) });
  await callApi(`/bookings/${longTerm.payload.data.booking._id}/cancel`, { method: "PATCH", cookie: familyACookie });

  const familyHistory = await callApi("/bookings", { cookie: familyACookie });
  const caregiverHistory = await callApi("/caregivers/bookings/mine", { cookie: caregiverCookie });
  if (familyHistory.payload.data.count < 4 || caregiverHistory.payload.data.count < 5) throw new Error("Booking history did not expose the full authenticated workflow.");
  console.log("Authenticated booking API smoke test passed.");
}

async function cleanup() {
  const users = await User.find({ email: { $regex: `^${marker}` } }).select("_id").lean();
  const ids = users.map((user) => user._id);
  await Notification.deleteMany({
    recipientUserId: {
      $in: ids,
    },
  });
  const bookings = await Booking.find({ $or: [{ familyMemberId: { $in: ids } }, { caregiverId: { $in: ids } }] }).select("_id").lean();
  await CareAssignment.deleteMany({
    sourceBookingId: {
      $in: bookings.map((booking) => booking._id),
    },
  });
  await BookingReservation.deleteMany({ bookingId: { $in: bookings.map((booking) => booking._id) } });
  await Booking.deleteMany({ _id: { $in: bookings.map((booking) => booking._id) } });
  const profiles = await ElderlyProfile.find({ createdBy: { $in: ids } }).select("_id").lean();
  await ElderlyFamilyLink.deleteMany({ elderlyProfileId: { $in: profiles.map((profile) => profile._id) } });
  await ElderlyProfile.deleteMany({ _id: { $in: profiles.map((profile) => profile._id) } });
  await CaregiverProfile.deleteMany({ userId: { $in: ids } });
  await User.deleteMany({ _id: { $in: ids } });
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
}

run().catch((error) => { console.error("Authenticated booking API smoke test failed:", error.message); process.exitCode = 1; }).finally(cleanup);
