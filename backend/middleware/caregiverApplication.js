import { CaregiverProfile } from "../models/CaregiverProfile.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Loads a caregiver profile and optionally restricts the request to allowed application states.
 * @param {...string} allowedStatuses - Status values allowed to continue; omit to allow every state.
 * @returns {import("express").RequestHandler} Caregiver application-state middleware.
 * @sideEffects Reads CaregiverProfile and attaches `request.caregiverProfile` and `request.caregiverApplicationStatus`.
 */
export function checkCaregiverApplicationStatus(...allowedStatuses) {
  return async function caregiverApplicationGate(request, _response, next) {
    try {
      const profile = await CaregiverProfile.findOne({ userId: request.user._id });
      const status = profile?.applicationStatus || "draft";
      request.caregiverProfile = profile;
      request.caregiverApplicationStatus = status;

      if (allowedStatuses.length && !allowedStatuses.includes(status)) {
        return next(
          new ApiError(403, "This action is unavailable for the current application status.", {
            applicationStatus: status,
          }),
        );
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
