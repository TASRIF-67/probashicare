import mongoose from "mongoose";
import { connectDatabase } from "../config/database.js";
import { validateEnvironment } from "../config/env.js";
import { User } from "../models/User.js";

/**
 * Synchronizes declared model indexes during controlled development migrations.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {Promise<void>}
 * @sideEffects Connects to MongoDB and creates/drops User collection indexes to match its schema.
 */
async function syncDatabaseIndexes() {
  validateEnvironment(["MONGODB_URI"]);
  await connectDatabase();
  await User.syncIndexes();
  console.log("User database indexes synchronized.");
}

syncDatabaseIndexes()
  .catch((error) => {
    console.error("Database index synchronization failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
