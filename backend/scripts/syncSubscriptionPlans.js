import mongoose from "mongoose";
import { connectDatabase } from "../config/database.js";
import { validateEnvironment } from "../config/env.js";
import { synchronizeSubscriptionPlans } from "../services/subscriptionPlanService.js";

/**
 * Synchronizes development subscription plans into MongoDB.
 * @returns {Promise<void>}
 * @sideEffects Connects to MongoDB, upserts plans, logs a count, and disconnects.
 * @throws {Error} Propagates configuration and database failures.
 */
async function runSubscriptionPlanSynchronization() {
  validateEnvironment(["MONGODB_URI"]);
  await connectDatabase();
  const result = await synchronizeSubscriptionPlans();

  console.log(
    result.synchronizedCount +
      " prototype subscription plans synchronized.",
  );
}

runSubscriptionPlanSynchronization()
  .catch((error) => {
    console.error("Subscription plan synchronization failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    return mongoose.disconnect();
  });
