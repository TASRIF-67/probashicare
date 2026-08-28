import assert from "node:assert/strict";
import test from "node:test";
import { escapeRegularExpression } from "../controllers/adminSubscriptionController.js";
import { validateSubscriptionPurchase } from "../middleware/validateSubscription.js";

/**
 * Executes subscription purchase validation with a small Express-like request.
 * @param {object} body - Candidate request body.
 * @returns {{request: object, forwardedError: Error|null}} Validation result.
 * @sideEffects Calls the middleware without starting an HTTP server.
 */
function runPurchaseValidation(body) {
  const request = {
    body,
  };
  let forwardedError = null;

  /**
   * Captures the value that Express would receive.
   * @param {Error} [error] - Optional forwarded validation error.
   * @returns {void}
   * @sideEffects Stores the forwarded error for the assertion.
   */
  function next(error) {
    if (error) {
      forwardedError = error;
    }
  }

  validateSubscriptionPurchase(request, {}, next);

  return {
    request,
    forwardedError,
  };
}

test("prototype validation accepts only prototype payment methods", () => {
  const result = runPurchaseValidation({
    planCode: "monthly",
    paymentMethod: "test_card",
  });

  assert.equal(result.forwardedError, null);
  assert.deepEqual(result.request.subscriptionPurchaseInput, {
    planCode: "monthly",
    paymentMethod: "test_card",
  });
});

test("prototype validation rejects Stripe checkout as a simulated method", () => {
  const result = runPurchaseValidation({
    planCode: "monthly",
    paymentMethod: "stripe_checkout",
  });

  assert.equal(result.forwardedError?.statusCode, 422);
  assert.equal(
    result.forwardedError?.details?.paymentMethod,
    "Choose a supported prototype payment method.",
  );
});

test("Admin transaction search escapes regular-expression operators", () => {
  const escaped = escapeRegularExpression("DEV-.*(test)+");

  assert.equal(escaped, "DEV-\\.\\*\\(test\\)\\+");
  assert.equal(new RegExp(escaped, "i").test("DEV-.*(test)+"), true);
  assert.equal(new RegExp(escaped, "i").test("DEV-anythingtest"), false);
});
