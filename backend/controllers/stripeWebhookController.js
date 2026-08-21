import {
  constructStripeWebhookEvent,
  processStripeWebhookEvent,
} from "../services/stripePaymentService.js";

/**
 * POST /api/subscriptions/stripe/webhook
 * Auth: Stripe-Signature verification replaces user authentication.
 * Body: raw Stripe event bytes; JSON parsing must not run before this handler.
 * Success 200: acknowledges supported and safely ignored Stripe events.
 * Failure 400: missing or invalid signature; other shared failures remain safe.
 * @param {import("express").Request} request - Raw signed Stripe request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Verifies the event and may update payment/subscription records.
 */
export async function receiveStripeWebhook(request, response) {
  const signature = request.headers["stripe-signature"];
  const event = constructStripeWebhookEvent(request.body, signature);
  await processStripeWebhookEvent(event);
  response.json({
    success: true,
    data: {
      received: true,
      eventId: event.id,
    },
  });
}
