/**
 * Forwards rejected controller promises to the shared Express error handler.
 * @param {import("express").RequestHandler} handler - Async Express controller.
 * @returns {import("express").RequestHandler} Express middleware with rejection forwarding.
 * @sideEffects Calls the supplied controller and may advance the middleware chain.
 */
export function asyncHandler(handler) {
  return function handledRequest(request, response, next) {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}
