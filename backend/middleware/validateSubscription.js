import mongoose from "mongoose";
import { SUBSCRIPTION_PLAN_CODES } from "../utils/subscriptionConstants.js";
import { ApiError } from "../utils/ApiError.js";

// The prototype endpoint must never accept stripe_checkout. Stripe payments
// have a separate endpoint and require signed provider confirmation.
const PROTOTYPE_PAYMENT_METHODS = [
  "test_card",
  "test_mobile_banking",
  "test_wallet",
];

/**
 * Validates a prototype purchase without accepting price or duration fields.
 * @param {import("express").Request} request - Express request body.
 * @param {import("express").Response} _response - Unused response.
 * @param {import("express").NextFunction} next - Express continuation.
 * @returns {void}
 * @sideEffects Attaches request.subscriptionPurchaseInput or forwards 422.
 */
export function validateSubscriptionPurchase(request, _response, next) {
  // Optional chaining avoids an exception when body is absent. `String`
  // normalizes values and `trim` removes surrounding whitespace.
  const planCode = String(request.body?.planCode || "").trim();
  const paymentMethod = String(request.body?.paymentMethod || "").trim();
  const errors = {};

  if (!SUBSCRIPTION_PLAN_CODES.includes(planCode)) {
    errors.planCode = "Choose an active subscription plan.";
  }

  if (!PROTOTYPE_PAYMENT_METHODS.includes(paymentMethod)) {
    errors.paymentMethod = "Choose a supported prototype payment method.";
  }

  // `Object.keys` returns an array of error field names.
  if (Object.keys(errors).length > 0) {
    next(new ApiError(422, "Check the subscription purchase details.", errors));
    return;
  }

  request.subscriptionPurchaseInput = {
    planCode,
    paymentMethod,
  };
  next();
}

/**
 * Validates the plan selected for a Stripe-hosted Checkout Session.
 * @param {import("express").Request} request - Express request body.
 * @param {import("express").Response} _response - Unused response.
 * @param {import("express").NextFunction} next - Express continuation.
 * @returns {void}
 * @sideEffects Attaches request.stripeCheckoutInput or forwards 422.
 */
export function validateStripeCheckout(request, _response, next) {
  const planCode = String(request.body?.planCode || "").trim();

  if (!SUBSCRIPTION_PLAN_CODES.includes(planCode)) {
    next(
      new ApiError(422, "Check the Stripe checkout details.", {
        planCode: "Choose an active subscription plan.",
      }),
    );
    return;
  }

  request.stripeCheckoutInput = {
    planCode,
  };
  next();
}

/**
 * Creates middleware that validates one MongoDB route identifier.
 * @param {string} parameterName - Express parameter key.
 * @returns {import("express").RequestHandler} ObjectId validation middleware.
 * @sideEffects Forwards a concealed 404 for malformed identifiers.
 */
export function validateSubscriptionObjectId(parameterName) {
  /**
   * Checks the configured route parameter.
   * @param {import("express").Request} request - Route request.
   * @param {import("express").Response} _response - Unused response.
   * @param {import("express").NextFunction} next - Express continuation.
   * @returns {void}
   * @sideEffects Continues or forwards a concealed 404.
   */
  return function checkSubscriptionObjectId(request, _response, next) {
    const identifier = request.params[parameterName];

    if (!mongoose.isValidObjectId(identifier)) {
      next(new ApiError(404, "Requested record not found."));
      return;
    }

    next();
  };
}

/**
 * Validates an optional subscription cancellation reason.
 * @param {import("express").Request} request - Express request body.
 * @param {import("express").Response} _response - Unused response.
 * @param {import("express").NextFunction} next - Express continuation.
 * @returns {void}
 * @sideEffects Attaches a normalized reason or forwards 422.
 */
export function validateSubscriptionCancellation(request, _response, next) {
  const reason = String(request.body?.reason || "").trim();

  if (reason.length > 500) {
    next(
      new ApiError(422, "Cancellation reason cannot exceed 500 characters."),
    );
    return;
  }

  request.subscriptionCancellationReason = reason;
  next();
}

/**
 * Validates reminder dismissal duration in hours.
 * @param {import("express").Request} request - Express request body.
 * @param {import("express").Response} _response - Unused response.
 * @param {import("express").NextFunction} next - Express continuation.
 * @returns {void}
 * @sideEffects Attaches a bounded integer duration or forwards 422.
 */
export function validateReminderDismissal(request, _response, next) {
  // `Number` converts query/body text to a number. The default is 24 hours.
  const hours = Number(request.body?.hours || 24);

  if (!Number.isInteger(hours) || hours < 1 || hours > 168) {
    next(
      new ApiError(422, "Reminder dismissal must be between 1 and 168 hours."),
    );
    return;
  }

  request.reminderDismissalHours = hours;
  next();
}
