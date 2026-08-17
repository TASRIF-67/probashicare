import { api } from "./api.js";

/**
 * Submits one verified family review for a completed booking.
 * @param {string} bookingId - Completed booking identifier.
 * @param {{rating: number, feedback: string}} input - Rating and optional feedback.
 * @returns {Promise<{message: string, review: object}>} Saved family review.
 * @sideEffects Calls POST /bookings/:bookingId/review.
 */
async function submitReview(bookingId, input) {
  const response = await api.post(
    "/bookings/" + bookingId + "/review",
    input,
  );
  return response.data.data;
}

/**
 * Submits one private complaint for a completed family booking.
 * @param {string} bookingId - Completed booking identifier.
 * @param {{category: string, description: string}} input - Complaint details.
 * @returns {Promise<{message: string, complaint: object}>} Saved complaint.
 * @sideEffects Calls POST /bookings/:bookingId/complaint.
 */
async function submitComplaint(bookingId, input) {
  const response = await api.post(
    "/bookings/" + bookingId + "/complaint",
    input,
  );
  return response.data.data;
}

/**
 * Lists anonymous feedback received by the signed-in caregiver.
 * @param {{page?: number, limit?: number}} [filters] - Pagination values.
 * @returns {Promise<{reviews: object[], summary: object, pagination: object}>} Review page.
 * @sideEffects Calls GET /caregivers/reviews/mine.
 */
async function listMyCaregiverReviews(filters = {}) {
  const response = await api.get("/caregivers/reviews/mine", {
    params: filters,
  });
  return response.data.data;
}

/**
 * Lists anonymous published reviews for one marketplace caregiver.
 * @param {string} caregiverId - Caregiver User identifier.
 * @param {{page?: number, limit?: number}} [filters] - Pagination values.
 * @returns {Promise<{caregiver: object, reviews: object[], pagination: object}>} Published review page.
 * @sideEffects Calls GET /caregivers/:id/reviews.
 */
async function listCaregiverReviews(caregiverId, filters = {}) {
  const response = await api.get(
    "/caregivers/" + caregiverId + "/reviews",
    {
      params: filters,
    },
  );
  return response.data.data;
}

export const caregiverFeedbackService = {
  submitReview,
  submitComplaint,
  listMyCaregiverReviews,
  listCaregiverReviews,
};
