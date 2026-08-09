import mongoose from "mongoose";
import { connectDatabase } from "../config/database.js";
import { validateEnvironment } from "../config/env.js";
import { User } from "../models/User.js";
import { CaregiverProfile } from "../models/CaregiverProfile.js";
import { Booking } from "../models/Booking.js";
import { BookingReservation } from "../models/BookingReservation.js";
import { CareAssignment } from "../models/CareAssignment.js";
import { Notification } from "../models/Notification.js";
import { WellnessReport } from "../models/WellnessReport.js";
import { WellnessAlert } from "../models/WellnessAlert.js";
import { WellnessInsight } from "../models/WellnessInsight.js";

/**
 * Synchronizes declared model indexes during controlled development migrations.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {Promise<void>}
 * @sideEffects Connects to MongoDB and synchronizes identity, caregiver, booking, assignment, notification, wellness-report, alert, and insight indexes.
 */
async function syncDatabaseIndexes() {
  validateEnvironment(["MONGODB_URI"]);
  await connectDatabase();
  await Promise.all([
    User.syncIndexes(),
    CaregiverProfile.syncIndexes(),
    Booking.syncIndexes(),
    BookingReservation.syncIndexes(),
    CareAssignment.syncIndexes(),
    Notification.syncIndexes(),
    WellnessReport.syncIndexes(),
    WellnessAlert.syncIndexes(),
    WellnessInsight.syncIndexes(),
  ]);
  console.log(
    "Identity, caregiver, booking, assignment, notification, wellness-report, alert, and insight indexes synchronized.",
  );
}

syncDatabaseIndexes()
  .catch((error) => {
    console.error("Database index synchronization failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
