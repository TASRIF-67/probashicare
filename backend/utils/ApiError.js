/**
 * Represents an operational HTTP error safe to return to an API client.
 * @param {number} statusCode - HTTP response status.
 * @param {string} message - Human-readable failure reason.
 * @param {Record<string, unknown>|null} [details=null] - Optional structured validation details.
 * @returns {ApiError} A configured error instance.
 * @sideEffects None.
 */
export class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }
}
