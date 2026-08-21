import axios from "axios";

let requestTimeout = 12000;
const configuredTimeout = Number(import.meta.env.VITE_API_TIMEOUT_MS);

// A hosted free backend can take close to a minute to wake after being idle.
// Number converts the text-based Vite environment value into milliseconds.
if (Number.isFinite(configuredTimeout) && configuredTimeout > 0) {
  requestTimeout = configuredTimeout;
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
  timeout: requestTimeout,
});

/**
 * Converts Axios and API failures into one UI-safe error shape.
 * @param {unknown} error - Error thrown by an API service call.
 * @returns {{message: string, details: Record<string, string>|null, status: number|null}} Normalized client error.
 * @sideEffects None.
 */
export function normalizeApiError(error) {
  return {
    message: error?.response?.data?.error?.message || "We could not complete that request.",
    details: error?.response?.data?.error?.details || null,
    status: error?.response?.status || null,
  };
}

export function buildCareTaskPayload(task) {
  return {
    title: task.title,
    instructions: task.instructions || "",
    priority: task.priority || "medium",
    visitDate: task.visitDate || "",
    elderlyProfileId: task.elderlyProfileId,
    caregiverUserId: task.caregiverUserId || undefined,
  };
}
