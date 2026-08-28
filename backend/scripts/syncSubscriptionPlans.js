import mongoose from "mongoose";
import { connectDatabase } from "../config/database.js";
import { validateEnvironment } from "../config/env.js";
import { synchronizeSubscriptionPlans } from "../services/subscriptionPlanService.js";

/**
 * Synchronizes code-defined development subscription plans into MongoDB.
 * @returns {Promise<void>} Resolves after all plan definitions are upserted.
 * @sideEffects Validates configuration, connects to MongoDB, writes plans,
 * and logs the synchronized count.
 * @throws {Error} Propagates configuration and database failures.
 */
async function runSubscriptionPlanSynchronization() {
  validateEnvironment(["MONGODB_URI"]);
  await connectDatabase();

  const result = await synchronizeSubscriptionPlans();
  const message =
    result.synchronizedCount + " prototype subscription plans synchronized.";

  console.log(message);
}

/**
 * Reports a failed synchronization and gives the Node process a failure code.
 * @param {Error} error - Configuration or database error.
 * @returns {void}
 * @sideEffects Writes to stderr and sets process.exitCode to 1.
 */
function handleSynchronizationFailure(error) {
  console.error("Subscription plan synchronization failed:", error.message);
  process.exitCode = 1;
}

/**
 * Closes the Mongoose connection after success or failure.
 * @returns {Promise<void>} Resolves when Mongoose disconnects.
 * @sideEffects Closes the process-wide MongoDB connection.
 */
async function closeDatabaseConnection() {
  await mongoose.disconnect();
}

// `catch` receives a rejected Promise. `finally` runs after either outcome, so
// the database connection is not left open when the script finishes.
runSubscriptionPlanSynchronization()
  .catch(handleSynchronizationFailure)
  .finally(closeDatabaseConnection);
