import { ApiError } from "../utils/ApiError.js";

/**
 * Converts unmatched routes into the shared operational error format.
 * @param {import("express").Request} request - Unmatched Express request.
 * @param {import("express").Response} _response - Express response, unused.
 * @param {import("express").NextFunction} next - Error middleware continuation.
 * @returns {void}
 * @sideEffects Forwards a 404 ApiError.
 */
export function notFound(request, _response, next) {
  next(new ApiError(404, `Route not found: ${request.method} ${request.originalUrl}`));
}

/**
 * Sends every controller and middleware failure through one predictable JSON shape.
 * @param {Error|ApiError} error - Error forwarded by Express.
 * @param {import("express").Request} _request - Express request, unused.
 * @param {import("express").Response} response - Express response writer.
 * @param {import("express").NextFunction} _next - Express continuation, unused.
 * @returns {void}
 * @sideEffects Logs unexpected errors and sends an HTTP response.
 */
export function errorHandler(error, _request, response, _next) {
  const isUploadError = error?.name === "MulterError";
  const isValidationError = error?.name === "ValidationError";
  const isDuplicateKeyError = error?.code === 11000;
  const statusCode =
    error instanceof ApiError ? error.statusCode : isValidationError || isUploadError ? 422 : isDuplicateKeyError ? 409 : 500;
  const message =
    error instanceof ApiError
      ? error.message
      : isUploadError
        ? error.code === "LIMIT_FILE_SIZE"
          ? "Verification document cannot exceed 5 MB."
          : "The verification document could not be accepted."
        : isValidationError
        ? "Please correct the submitted information."
        : isDuplicateKeyError
          ? "A record with that unique information already exists."
          : "An unexpected server error occurred.";
  const validationDetails = isValidationError
    ? Object.fromEntries(
        Object.entries(error.errors).map(([field, issue]) => [field, issue.message]),
      )
    : null;

  if (!(error instanceof ApiError) && !isValidationError && !isDuplicateKeyError && !isUploadError) {
    console.error(error);
  }

  response.status(statusCode).json({
    success: false,
    error: { message, details: error.details || validationDetails },
  });
}
