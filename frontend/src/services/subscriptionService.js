import { api } from "./api.js";

/** Loads backend-controlled plans. @returns {Promise<object[]>} Active plans. @sideEffects Calls the API. */
async function listPlans() {
  const response = await api.get("/subscriptions/plans");
  return response.data.data.plans;
}

/** Loads current Family access and reminder. @returns {Promise<object>} Subscription state. @sideEffects Calls the API and may synchronize expiry/reminders. */
async function getMySubscription() {
  const response = await api.get("/subscriptions/me");
  return response.data.data;
}

/** Activates the one-time trial. @returns {Promise<object>} Activated state. @sideEffects Calls the trial API. */
async function activateTrial() {
  const response = await api.post("/subscriptions/trial/activate");
  return response.data.data;
}

/** Creates a pending prototype payment. @param {object} payload - Plan code and test method. @returns {Promise<object>} Pending payment. @sideEffects Calls the purchase API. */
async function purchase(payload) {
  const response = await api.post("/subscriptions/purchase", payload);
  return response.data.data.payment;
}

/** Completes a test payment. @param {string} id - Payment ID. @returns {Promise<object>} Completion result. @sideEffects Calls simulation API. */
async function simulateSuccess(id) {
  const response = await api.post(
    `/subscriptions/payments/${id}/simulate-success`,
  );
  return response.data.data;
}

/** Fails a test payment. @param {string} id - Payment ID. @returns {Promise<object>} Failed payment. @sideEffects Calls simulation API. */
async function simulateFailure(id) {
  const response = await api.post(
    `/subscriptions/payments/${id}/simulate-failure`,
  );
  return response.data.data;
}

/** Cancels a pending test payment. @param {string} id - Payment ID. @returns {Promise<object>} Cancelled payment. @sideEffects Calls simulation API. */
async function cancelPayment(id) {
  const response = await api.post(
    `/subscriptions/payments/${id}/cancel`,
  );
  return response.data.data;
}

/** Lists caller-owned payment history. @param {{page?: number, limit?: number}} [options] - Pagination options. @returns {Promise<object>} Payment history. @sideEffects Calls the API. */
async function listPayments(options = {}) {
  const response = await api.get("/subscriptions/payments", { params: options });
  return response.data.data;
}

/** Persists reminder dismissal. @param {string} id - Notification ID. @param {number} hours - Dismissal duration. @returns {Promise<object>} Notification. @sideEffects Calls notification API. */
async function dismissReminder(id, hours = 24) {
  const response = await api.patch(`/notifications/${id}/dismiss`, {
    hours,
  });
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
  listPayments,
  dismissReminder,
};
