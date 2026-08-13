import mongoose from "mongoose";
import { connectDatabase } from "../config/database.js";
import { validateEnvironment } from "../config/env.js";
import { User } from "../models/User.js";
import { CaregiverProfile } from "../models/CaregiverProfile.js";
import { Booking } from "../models/Booking.js";
import { BookingReservation } from "../models/BookingReservation.js";
import { FamilyBookingReservation } from "../models/FamilyBookingReservation.js";
import { FamilySubscription } from "../models/FamilySubscription.js";
import { SubscriptionPayment } from "../models/SubscriptionPayment.js";
import { SubscriptionPlan } from "../models/SubscriptionPlan.js";
import { Notification } from "../models/Notification.js";
import { CareAssignment } from "../models/CareAssignment.js";
import { WellnessReport } from "../models/WellnessReport.js";
import { WellnessAlert } from "../models/WellnessAlert.js";
import { WellnessInsight } from "../models/WellnessInsight.js";

/**
 * Synchronizes declared model indexes during controlled development migrations.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {Promise<void>}
 * @sideEffects Connects to MongoDB and synchronizes identity, caregiver, booking, subscription, notification, assignment, and wellness indexes.
 */
async function syncDatabaseIndexes() {
  validateEnvironment(["MONGODB_URI"]);
  await connectDatabase();
  await Promise.all([
    User.syncIndexes(),
    CaregiverProfile.syncIndexes(),
    Booking.syncIndexes(),
    BookingReservation.syncIndexes(),
    FamilyBookingReservation.syncIndexes(),
    SubscriptionPlan.syncIndexes(),
    FamilySubscription.syncIndexes(),
    SubscriptionPayment.syncIndexes(),
    Notification.syncIndexes(),
    CareAssignment.syncIndexes(),
    WellnessReport.syncIndexes(),
    WellnessAlert.syncIndexes(),
    WellnessInsight.syncIndexes(),
  ]);
  console.log(
    "User, caregiver, booking, caregiver reservation, family-date reservation, subscription, notification, assignment, and wellness indexes synchronized.",
  );
}

syncDatabaseIndexes()
  .catch((error) => {
    console.error("Database index synchronization failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
