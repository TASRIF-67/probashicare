import assert from "node:assert/strict";
import test from "node:test";
import { requireFamilyEntitlement } from "../middleware/requireFamilyEntitlement.js";
import {
  determineSubscriptionAccess,
  hasEntitlement,
} from "../services/entitlementService.js";
import { ENTITLEMENTS } from "../utils/subscriptionConstants.js";

const NOW = new Date("2026-08-12T10:00:00.000Z");

test("missing subscription receives Core access", () => {
  const access = determineSubscriptionAccess(null, NOW);

  assert.equal(access.accessLevel, "core");
  assert.equal(access.status, "none");
  assert.equal(access.isPremium, false);
  assert.deepEqual(access.entitlements, []);
});

test("active trial receives every Premium entitlement", () => {
  const access = determineSubscriptionAccess(
    {
      accessLevel: "premium",
      status: "trialing",
      currentPeriodEndsAt: "2026-08-19T10:00:00.000Z",
    },
    NOW,
  );

  assert.equal(access.isPremium, true);
  assert.equal(
    hasEntitlement(access, ENTITLEMENTS.CAREGIVER_BOOKING),
    true,
  );
  assert.equal(
    hasEntitlement(access, ENTITLEMENTS.WELLNESS_AI_SUMMARY),
    true,
  );
});

test("expired trial returns effective Core access", () => {
  const access = determineSubscriptionAccess(
    {
      accessLevel: "premium",
      status: "trialing",
      currentPeriodEndsAt: "2026-08-12T09:59:59.000Z",
    },
    NOW,
  );

  assert.equal(access.accessLevel, "core");
  assert.equal(access.status, "expired");
  assert.equal(access.isPremium, false);
});

test("paid access uses the saved plan entitlement snapshot", () => {
  const access = determineSubscriptionAccess(
    {
      accessLevel: "premium",
      status: "active",
      currentPeriodEndsAt: "2026-09-12T10:00:00.000Z",
      planSnapshot: {
        features: [
          ENTITLEMENTS.CAREGIVER_BOOKING,
          ENTITLEMENTS.SCHEDULED_BOOKING,
        ],
      },
    },
    NOW,
  );

  assert.equal(
    hasEntitlement(access, ENTITLEMENTS.CAREGIVER_BOOKING),
    true,
  );
  assert.equal(
    hasEntitlement(access, ENTITLEMENTS.WELLNESS_AI_SUMMARY),
    false,
  );
});

test("cancelled subscription does not provide Premium access", () => {
  const access = determineSubscriptionAccess(
    {
      accessLevel: "premium",
      status: "cancelled",
      currentPeriodEndsAt: "2026-09-12T10:00:00.000Z",
    },
    NOW,
  );

  assert.equal(access.accessLevel, "core");
  assert.equal(access.isPremium, false);
});

test("unknown entitlement codes are never granted", () => {
  const access = determineSubscriptionAccess(
    {
      accessLevel: "premium",
      status: "trialing",
      currentPeriodEndsAt: "2026-08-19T10:00:00.000Z",
    },
    NOW,
  );

  assert.equal(hasEntitlement(access, "unknown_feature"), false);
  assert.throws(() => {
    requireFamilyEntitlement("unknown_feature");
  }, /known Family entitlement/);
});

test("known entitlement creates reusable Express middleware", () => {
  const middleware = requireFamilyEntitlement(
    ENTITLEMENTS.CAREGIVER_BOOKING,
  );

  assert.equal(typeof middleware, "function");
});
