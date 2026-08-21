import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "../utils/ApiError.js";
import {
  convertBdtToStripeMinorUnits,
  validateStripeCheckoutPayment,
} from "../services/stripePaymentService.js";

/**
 * Creates the minimum local payment shape required by Stripe validation.
 * @param {Partial<object>} [overrides={}] - Fields that replace valid defaults.
 * @returns {{amount: number, currency: string}} Local payment-like value.
 * @sideEffects None.
 */
function createPayment(overrides = {}) {
  return {
    amount: 1499,
    currency: "BDT",
    ...overrides,
  };
}

/**
 * Creates the minimum paid Checkout Session shape required by validation.
 * @param {Partial<object>} [overrides={}] - Fields that replace valid defaults.
 * @returns {{payment_status: string, amount_total: number, currency: string}} Stripe Session-like value.
 * @sideEffects None.
 */
function createCheckoutSession(overrides = {}) {
  return {
    payment_status: "paid",
    amount_total: 149900,
    currency: "bdt",
    ...overrides,
  };
}

test("BDT plan amounts convert to Stripe minor units", () => {
  assert.equal(convertBdtToStripeMinorUnits(199), 19900);
  assert.equal(convertBdtToStripeMinorUnits(1499), 149900);
});

test("invalid Stripe amounts are rejected before calling the provider", () => {
  assert.throws(
    () => convertBdtToStripeMinorUnits(0),
    (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 422);
      return true;
    },
  );
});

test("a paid matching Stripe Checkout Session passes validation", () => {
  assert.doesNotThrow(() => {
    validateStripeCheckoutPayment(
      createCheckoutSession(),
      createPayment(),
    );
  });
});

test("a mismatched Stripe total is rejected", () => {
  assert.throws(
    () => {
      validateStripeCheckoutPayment(
        createCheckoutSession({ amount_total: 19900 }),
        createPayment(),
      );
    },
    (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 409);
      return true;
    },
  );
});
