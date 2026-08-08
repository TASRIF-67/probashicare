import mongoose from "mongoose";
import { connectDatabase } from "../config/database.js";
import { validateEnvironment } from "../config/env.js";
import { Booking } from "../models/Booking.js";
import { BookingReservation } from "../models/BookingReservation.js";
import { ElderlyFamilyLink } from "../models/ElderlyFamilyLink.js";
import { ElderlyProfile } from "../models/ElderlyProfile.js";
import { buildOccurrences, buildReservationDocuments, parseTimeSlot, weekday } from "../utils/bookingSchedule.js";

const ACTIVE_STATUSES = new Set(["pending", "accepted", "confirmed"]);

async function resolveElderlyProfile(booking) {
  if (booking.elderlyProfileId && await ElderlyProfile.exists({ _id: booking.elderlyProfileId })) return booking.elderlyProfileId;
  const links = await ElderlyFamilyLink.find({ familyUserId: booking.familyMemberId, status: "active" }).select("elderlyProfileId").lean();
  const profiles = await ElderlyProfile.find({ _id: { $in: links.map((link) => link.elderlyProfileId) }, status: "active" }).select("_id").lean();
  return profiles.length === 1 ? profiles[0]._id : null;
}

async function migrateBooking(booking) {
  const parsed = parseTimeSlot(booking.timeSlot);
  const elderlyProfileId = await resolveElderlyProfile(booking);
  if (!parsed || !elderlyProfileId || !booking.startDate || !booking.endDate) {
    await Booking.collection.updateOne({ _id: booking._id }, { $set: { migrationStatus: "requires-review" } });
    return false;
  }
  const [startTime, endTime] = booking.timeSlot.split("-");
  const slots = [{ weekday: weekday(new Date(booking.startDate)), startTime, endTime }];
  const occurrences = buildOccurrences({ bookingType: booking.bookingType, startDate: new Date(booking.startDate), endDate: new Date(booking.endDate), slots });
  if (!occurrences.length) return false;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await BookingReservation.deleteMany({ bookingId: booking._id }).session(session);
      if (ACTIVE_STATUSES.has(booking.status)) {
        const reservations = buildReservationDocuments({ bookingId: booking._id, caregiverId: booking.caregiverId, occurrences });
        await BookingReservation.insertMany(reservations, { ordered: true, session });
      }
      await Booking.collection.updateOne({ _id: booking._id }, { $set: { elderlyProfileId, slots, occurrences, schemaVersion: 2, migrationStatus: "current" } }, { session });
    });
    return true;
  } catch (error) {
    await Booking.collection.updateOne({ _id: booking._id }, { $set: { migrationStatus: "requires-review" } });
    return false;
  } finally {
    await session.endSession();
  }
}

async function run() {
  validateEnvironment(["MONGODB_URI"]);
  await connectDatabase();
  const legacy = await Booking.collection.find({ $or: [{ schemaVersion: { $ne: 2 } }, { occurrences: { $exists: false } }, { occurrences: { $size: 0 } }, { elderlyProfileId: { $exists: false } }] }).toArray();
  let migrated = 0;
  let unresolvedActive = 0;
  for (const booking of legacy) {
    const success = await migrateBooking(booking);
    if (success) migrated += 1;
    else if (ACTIVE_STATUSES.has(booking.status)) unresolvedActive += 1;
  }
  console.log(`Legacy booking migration finished: ${migrated} migrated, ${legacy.length - migrated} require review.`);
  if (unresolvedActive) throw new Error(`${unresolvedActive} active legacy booking(s) require manual review before accepting new bookings.`);
}

run().catch((error) => { console.error("Legacy booking migration failed:", error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
