import mongoose from "mongoose";
import { connectDatabase } from "../config/database.js";
import { validateEnvironment } from "../config/env.js";
import { User } from "../models/User.js";
import { CaregiverProfile } from "../models/CaregiverProfile.js";
import { CareAssignment } from "../models/CareAssignment.js";
import { WellnessReport } from "../models/WellnessReport.js";

/**
 * Synchronizes declared model indexes during controlled development migrations.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {Promise<void>}
 * @sideEffects Connects to MongoDB and synchronizes identity, caregiver, assignment, and wellness indexes.
 */
async function syncDatabaseIndexes() {
  validateEnvironment(["MONGODB_URI"]);
  await connectDatabase();
  await Promise.all([
    User.syncIndexes(),
    CaregiverProfile.syncIndexes(),
    CareAssignment.syncIndexes(),
    WellnessReport.syncIndexes(),
  ]);
  console.log("Identity, caregiver, assignment, and wellness database indexes synchronized.");
}

syncDatabaseIndexes()
  .catch((error) => {
    console.error("Database index synchronization failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
