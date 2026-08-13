import mongoose from "mongoose";
import {
  PAYMENT_METHODS,
  SUBSCRIPTION_PLAN_CODES,
} from "../utils/subscriptionConstants.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Validates a subscription purchase without accepting price or duration fields.
 * @param {import("express").Request} request - Express request body.
 * @param {import("express").Response} _response - Unused response.
 * @param {import("express").NextFunction} next - Express continuation.
 * @returns {void}
 * @sideEffects Attaches request.subscriptionPurchaseInput or forwards 422.
 */
export function validateSubscriptionPurchase(request, _response, next) {
  const planCode = String(request.body?.planCode || "").trim();
  const paymentMethod = String(request.body?.paymentMethod || "").trim();
  const errors = {};

  if (!SUBSCRIPTION_PLAN_CODES.includes(planCode)) {
    errors.planCode = "Choose an active subscription plan.";
  }

  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    errors.paymentMethod = "Choose a supported prototype payment method.";
  }

  if (Object.keys(errors).length) {
    next(new ApiError(422, "Check the subscription purchase details.", errors));
    return;
  }

  request.subscriptionPurchaseInput = { planCode, paymentMethod };
  next();
}

/**
 * Validates a MongoDB payment or notification route identifier.
 * @param {string} parameterName - Express parameter key.
 * @returns {import("express").RequestHandler} Parameter validation middleware.
 * @sideEffects Forwards a concealed 404 for malformed identifiers.
 */
export function validateSubscriptionObjectId(parameterName) {
  return function checkSubscriptionObjectId(request, _response, next) {
    if (!mongoose.isValidObjectId(request.params[parameterName])) {
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
    next(new ApiError(422, "Cancellation reason cannot exceed 500 characters."));
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
 * @sideEffects Attaches a bounded dismissal duration or forwards 422.
 */
export function validateReminderDismissal(request, _response, next) {
  const hours = Number(request.body?.hours || 24);

  if (!Number.isInteger(hours) || hours < 1 || hours > 168) {
    next(new ApiError(422, "Reminder dismissal must be between 1 and 168 hours."));
    return;
  }

  request.reminderDismissalHours = hours;
  next();
}
