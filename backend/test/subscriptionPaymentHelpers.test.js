import assert from "node:assert/strict";
import test from "node:test";
import { SUBSCRIPTION_PLAN_DEFINITIONS } from "../config/subscriptionPlans.js";
import {
  createPlanSnapshot,
  generatePrototypeTransactionReference,
} from "../services/prototypePaymentService.js";
import { getReminderThresholds } from "../services/subscriptionReminderService.js";

test("plan snapshot copies authoritative price and duration", () => {
  const plan = SUBSCRIPTION_PLAN_DEFINITIONS[1];
  const snapshot = createPlanSnapshot(plan);

  assert.equal(snapshot.code, "monthly");
  assert.equal(snapshot.price, 1499);
  assert.equal(snapshot.currency, "BDT");
  assert.equal(snapshot.durationType, "months");
  assert.equal(snapshot.durationValue, 1);
  assert.notEqual(snapshot.features, plan.features);
});

test("prototype references are unique and clearly development-only", () => {
  const first = generatePrototypeTransactionReference();
  const second = generatePrototypeTransactionReference();

  assert.match(first, /^DEV-/);
  assert.notEqual(first, second);
});

test("trial reminders use two-day and one-day thresholds", () => {
  const thresholds = getReminderThresholds({ status: "trialing" });
  assert.deepEqual(
    thresholds.map((threshold) => threshold.key),
    ["2d", "1d"],
  );
});

test("Day Pass reminders use two-hour and thirty-minute thresholds", () => {
  const thresholds = getReminderThresholds({
    status: "active",
    planSnapshot: { code: "day_pass" },
  });
  assert.deepEqual(
    thresholds.map((threshold) => threshold.key),
    ["2h", "30m"],
  );
});

test("monthly and yearly reminders share seven-three-one day thresholds", () => {
  const thresholds = getReminderThresholds({
    status: "active",
    planSnapshot: { code: "yearly" },
  });
  assert.deepEqual(
    thresholds.map((threshold) => threshold.key),
    ["7d", "3d", "1d"],
  );
});
