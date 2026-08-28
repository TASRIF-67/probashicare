import { api } from "./api.js";

/**
 * Loads the backend-controlled plan catalog and payment availability.
 * @returns {Promise<{plans: object[], paymentOptions: object}>} Plan catalog.
 * @sideEffects Sends one authenticated GET request.
 */
async function listPlans() {
  const response = await api.get("/subscriptions/plans");
  return response.data.data;
}

/**
 * Loads the signed-in Family account's effective subscription access.
 * @returns {Promise<object>} Subscription, access, and reminder state.
 * @sideEffects Sends a GET request that may synchronize expiry and reminders.
 */
async function getMySubscription() {
  const response = await api.get("/subscriptions/me");
  return response.data.data;
}

/**
 * Activates the signed-in Family account's one-time trial.
 * @returns {Promise<object>} Activated subscription and effective access.
 * @sideEffects Sends one authenticated POST request.
 */
async function activateTrial() {
  const response = await api.post("/subscriptions/trial/activate");
  return response.data.data;
}

/**
 * Creates a pending prototype payment without sending a client-side price.
 * @param {{planCode: string, paymentMethod: string}} payload - Plan and method.
 * @returns {Promise<object>} Newly created pending payment document.
 * @sideEffects Sends one authenticated POST request.
 */
async function purchase(payload) {
  const response = await api.post("/subscriptions/purchase", payload);
  return response.data.data.payment;
}

/**
 * Marks a caller-owned prototype payment successful.
 * @param {string} id - MongoDB payment identifier.
 * @returns {Promise<object>} Completed payment and activated subscription.
 * @sideEffects Sends a POST request that updates payment and access records.
 */
async function simulateSuccess(id) {
  // String concatenation makes the dynamic route segment easy to identify.
  const requestPath = "/subscriptions/payments/" + id + "/simulate-success";
  const response = await api.post(requestPath);
  return response.data.data;
}

/**
 * Marks a caller-owned prototype payment failed without granting access.
 * @param {string} id - MongoDB payment identifier.
 * @returns {Promise<object>} Failed payment result.
 * @sideEffects Sends one authenticated POST request.
 */
async function simulateFailure(id) {
  const requestPath = "/subscriptions/payments/" + id + "/simulate-failure";
  const response = await api.post(requestPath);
  return response.data.data;
}

/**
 * Cancels a caller-owned pending prototype payment.
 * @param {string} id - MongoDB payment identifier.
 * @returns {Promise<object>} Cancelled or already-settled payment result.
 * @sideEffects Sends one authenticated POST request.
 */
async function cancelPayment(id) {
  const requestPath = "/subscriptions/payments/" + id + "/cancel";
  const response = await api.post(requestPath);
  return response.data.data;
}

/**
 * Creates a Stripe-hosted sandbox Checkout Session.
 * @param {string} planCode - Backend-controlled plan code.
 * @returns {Promise<{payment: object, checkoutUrl: string, sessionId: string}>} Checkout details.
 * @sideEffects Calls the API and creates a pending payment.
 */
async function createStripeCheckout(planCode) {
  const requestBody = {
    planCode,
  };
  const response = await api.post(
    "/subscriptions/stripe/checkout",
    requestBody,
  );
  return response.data.data;
}

/**
 * Loads the local result written by the verified Stripe webhook.
 * @param {string} sessionId - Stripe Checkout Session ID.
 * @returns {Promise<object>} Caller-owned local payment.
 * @sideEffects Sends one authenticated GET request.
 */
async function getStripeCheckoutStatus(sessionId) {
  // `encodeURIComponent` makes provider text safe inside one URL segment.
  const encodedSessionId = encodeURIComponent(sessionId);
  const requestPath = "/subscriptions/stripe/checkouts/" + encodedSessionId;
  const response = await api.get(requestPath);
  return response.data.data.payment;
}

/**
 * Cancels an open caller-owned Stripe Checkout Session.
 * @param {string} paymentId - Local SubscriptionPayment ID.
 * @returns {Promise<object>} Cancelled or terminal local payment.
 * @sideEffects Calls Stripe through the backend and updates MongoDB.
 */
async function cancelStripeCheckout(paymentId) {
  const requestPath = "/subscriptions/stripe/payments/" + paymentId + "/cancel";
  const response = await api.post(requestPath);
  return response.data.data.payment;
}

/**
 * Lists the signed-in Family account's paginated payment history.
 * @param {{page?: number, limit?: number}} [options={}] - Pagination options.
 * @returns {Promise<{payments: object[], pagination: object}>} History page.
 * @sideEffects Sends one authenticated GET request.
 */
async function listPayments(options = {}) {
  const requestOptions = {
    params: options,
  };
  const response = await api.get("/subscriptions/payments", requestOptions);
  return response.data.data;
}

/**
 * Hides a subscription reminder for a bounded number of hours.
 * @param {string} id - Notification identifier.
 * @param {number} [hours=24] - Dismissal duration.
 * @returns {Promise<object>} Updated notification document.
 * @sideEffects Sends one authenticated PATCH request.
 */
async function dismissReminder(id, hours = 24) {
  const requestPath = "/notifications/" + id + "/dismiss";
  const requestBody = {
    hours,
  };
  const response = await api.patch(requestPath, requestBody);
  return response.data.data.notification;
}

export const subscriptionService = {
  listPlans,
  getMySubscription,
  activateTrial,
  purchase,
  simulateSuccess,
  simulateFailure,
  cancelPayment,
  createStripeCheckout,
  getStripeCheckoutStatus,
  cancelStripeCheckout,
  listPayments,
  dismissReminder,
};
