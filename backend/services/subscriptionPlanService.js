import { SUBSCRIPTION_PLAN_DEFINITIONS } from "../config/subscriptionPlans.js";
import { SubscriptionPlan } from "../models/SubscriptionPlan.js";

/**
 * Creates or updates backend-controlled prototype subscription plans.
 * @returns {Promise<{synchronizedCount: number}>} Number of plan definitions processed.
 * @sideEffects Upserts SubscriptionPlan documents in MongoDB.
 * @throws {Error} Propagates MongoDB validation and write failures.
 */
export async function synchronizeSubscriptionPlans() {
  let synchronizedCount = 0;

  for (const definition of SUBSCRIPTION_PLAN_DEFINITIONS) {
    await SubscriptionPlan.updateOne(
      {
        code: definition.code,
      },
      {
        $set: definition,
      },
      {
        upsert: true,
        runValidators: true,
      },
    );
    synchronizedCount += 1;
  }

  return {
    synchronizedCount,
  };
}

/*
 * A real pricing administration tool may replace this development synchronizer.
 * Historical subscription and payment snapshots remain unchanged.
 */
