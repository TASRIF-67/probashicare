import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
  timeout: 12000,
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
