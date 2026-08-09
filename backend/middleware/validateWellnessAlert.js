import mongoose from "mongoose";
import {
  WELLNESS_ALERT_CATEGORIES,
  WELLNESS_ALERT_SEVERITIES,
  WELLNESS_ALERT_STATUSES,
} from "../models/WellnessAlert.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Validates one MongoDB route parameter.
 * @param {string} parameterName - Express route-parameter name.
 * @returns {import("express").RequestHandler} Validation middleware.
 * @sideEffects Passes control or forwards a concealed 404 ApiError.
 */
export function validateObjectIdParameter(parameterName) {
  /**
   * Checks the configured route parameter.
   * @param {import("express").Request} request - Express request.
   * @param {import("express").Response} _response - Unused response.
   * @param {import("express").NextFunction} next - Express continuation.
   * @returns {void}
   * @sideEffects Calls the next middleware with or without an error.
   */
  function validateParameter(request, _response, next) {
    if (!mongoose.isValidObjectId(request.params[parameterName])) {
      next(new ApiError(404, "Wellness resource not found."));
      return;
    }

    next();
  }

  return validateParameter;
}

/**
 * Validates optional wellness-alert list filters.
 * @param {import("express").Request} request - Request containing query filters.
 * @param {import("express").Response} _response - Unused response.
 * @param {import("express").NextFunction} next - Express continuation.
 * @returns {void}
 * @sideEffects Passes control or forwards a 422 ApiError.
 */
export function validateWellnessAlertFilters(request, _response, next) {
  const { status, severity, category } = request.query;

  if (status && !WELLNESS_ALERT_STATUSES.includes(status)) {
    next(new ApiError(422, "Choose a valid alert status."));
    return;
  }

  if (severity && !WELLNESS_ALERT_SEVERITIES.includes(severity)) {
    next(new ApiError(422, "Choose a valid alert severity."));
    return;
  }

  if (category && !WELLNESS_ALERT_CATEGORIES.includes(category)) {
    next(new ApiError(422, "Choose a valid alert category."));
    return;
  }

  next();
}

/**
 * Validates and normalizes a required alert resolution note.
 * @param {import("express").Request} request - Request containing resolutionNote.
 * @param {import("express").Response} _response - Unused response.
 * @param {import("express").NextFunction} next - Express continuation.
 * @returns {void}
 * @sideEffects Updates the request body or forwards a 422 ApiError.
 */
export function validateResolutionNote(request, _response, next) {
  const resolutionNote = String(request.body?.resolutionNote || "").trim();

  if (resolutionNote.length < 3) {
    next(new ApiError(422, "Resolution note must contain at least 3 characters."));
    return;
  }

  if (resolutionNote.length > 1000) {
    next(new ApiError(422, "Resolution note cannot exceed 1000 characters."));
    return;
  }

  request.body.resolutionNote = resolutionNote;
  next();
}
