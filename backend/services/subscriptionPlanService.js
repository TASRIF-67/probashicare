import { SUBSCRIPTION_PLAN_DEFINITIONS } from "../config/subscriptionPlans.js";
import { SubscriptionPlan } from "../models/SubscriptionPlan.js";

/**
 * Creates or updates backend-controlled development subscription plans.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {Promise<{synchronizedCount: number}>} Number of definitions processed.
 * @sideEffects Upserts SubscriptionPlan documents in MongoDB.
 */
export async function synchronizeSubscriptionPlans() {
  let synchronizedCount = 0;

  for (const definition of SUBSCRIPTION_PLAN_DEFINITIONS) {
    // `updateOne` with `upsert` updates an existing code or inserts it when
    // missing. The unique code index prevents duplicate catalog entries.
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
 * Historical subscriptions/payments store snapshots, so synchronizing today's
 * catalog never changes what an earlier family purchased.
 */
