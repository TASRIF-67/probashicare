import mongoose from "mongoose";
import { connectDatabase } from "../config/database.js";
import { validateEnvironment } from "../config/env.js";
import { User } from "../models/User.js";
import { CaregiverProfile } from "../models/CaregiverProfile.js";

/**
 * Synchronizes declared model indexes during controlled development migrations.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {Promise<void>}
 * @sideEffects Connects to MongoDB and synchronizes User and CaregiverProfile indexes.
 */
async function syncDatabaseIndexes() {
  validateEnvironment(["MONGODB_URI"]);
  await connectDatabase();
  await Promise.all([User.syncIndexes(), CaregiverProfile.syncIndexes()]);
  console.log("User and caregiver-profile database indexes synchronized.");
}

syncDatabaseIndexes()
  .catch((error) => {
    console.error("Database index synchronization failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
