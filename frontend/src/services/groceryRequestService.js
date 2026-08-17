import { api } from "./api.js";

/**
 * Lists assignment-backed elderly choices for the current caregiver.
 * @returns {Promise<{assignments: object[], count: number}>} Available care assignments.
 * @sideEffects Calls the authenticated grocery assignments endpoint.
 */
async function listAssignments() {
  const response = await api.get("/grocery-requests/assignments");
  return response.data.data;
}

/**
 * Submits a new caregiver grocery or essentials request.
 * @param {object} payload - Assignment, item, urgency, date, note, and budget fields.
 * @returns {Promise<{request: object, message: string}>} Created request and feedback.
 * @sideEffects Creates a grocery request and family notifications.
 */
async function createRequest(payload) {
  const response = await api.post("/grocery-requests", payload);
  return response.data.data;
}

/**
 * Lists requests owned by the current caregiver.
 * @param {{page?: number, limit?: number}} options - Pagination values.
 * @returns {Promise<{requests: object[], pagination: object}>} Caregiver request page.
 * @sideEffects Calls the caregiver grocery history endpoint.
 */
async function listCaregiverRequests(options = {}) {
  const response = await api.get("/grocery-requests/caregiver/mine", {
    params: options,
  });
  return response.data.data;
}

/**
 * Lists requests connected to the current family's elderly profiles.
 * @param {{page?: number, limit?: number}} options - Pagination values.
 * @returns {Promise<{requests: object[], pagination: object}>} Family request page.
 * @sideEffects Calls the family grocery history endpoint.
 */
async function listFamilyRequests(options = {}) {
  const response = await api.get("/grocery-requests/family/mine", {
    params: options,
  });
  return response.data.data;
}

/**
 * Approves or rejects one submitted request as an authorized family member.
 * @param {string} requestId - GroceryRequest identifier.
 * @param {object} payload - Decision, budget, fulfilment method, and note.
 * @returns {Promise<{request: object, message: string}>} Updated request.
 * @sideEffects Changes the request status and notifies its caregiver.
 */
async function reviewRequest(requestId, payload) {
  const response = await api.patch(
    `/grocery-requests/family/${requestId}/review`,
    payload,
  );
  return response.data.data;
}

/**
 * Records purchase or remote-order details for the active role.
 * @param {"family"|"caregiver"} role - Current workflow role.
 * @param {string} requestId - GroceryRequest identifier.
 * @param {object} payload - Total, payment, store, reference, and note.
 * @returns {Promise<{request: object, message: string}>} Updated request.
 * @sideEffects Writes purchase data and sends a workflow notification.
 */
async function recordPurchase(role, requestId, payload) {
  const response = await api.patch(
    `/grocery-requests/${role}/${requestId}/purchase`,
    payload,
  );
  return response.data.data;
}

/**
 * Moves a grocery request through one permitted operational transition.
 * @param {"family"|"caregiver"} role - Current workflow role.
 * @param {string} requestId - GroceryRequest identifier.
 * @param {{status: string, note?: string}} payload - Requested status and note.
 * @returns {Promise<{request: object, message: string}>} Updated request.
 * @sideEffects Writes status history and sends notifications.
 */
async function updateStatus(role, requestId, payload) {
  const response = await api.patch(
    `/grocery-requests/${role}/${requestId}/status`,
    payload,
  );
  return response.data.data;
}

/**
 * Uploads optional purchase evidence for the active role.
 * @param {"family"|"caregiver"} role - Current workflow role.
 * @param {string} requestId - GroceryRequest identifier.
 * @param {File} file - PDF, JPEG, or PNG receipt file.
 * @returns {Promise<{request: object, message: string}>} Updated request.
 * @sideEffects Uploads a private file and replaces older evidence.
 */
async function uploadReceipt(role, requestId, file) {
  const formData = new FormData();
  formData.append("receipt", file);
  const response = await api.post(
    `/grocery-requests/${role}/${requestId}/receipt`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );
  return response.data.data;
}

/**
 * Records whether an outside-app payment or reimbursement was settled.
 * @param {string} requestId - GroceryRequest identifier.
 * @param {boolean} settled - New settlement state.
 * @returns {Promise<{request: object, message: string}>} Updated request.
 * @sideEffects Updates the family's payment audit flag.
 */
async function updateSettlement(requestId, settled) {
  const response = await api.patch(
    `/grocery-requests/family/${requestId}/payment-settled`,
    { settled },
  );
  return response.data.data;
}

/**
 * Resolves a deliberately entered Bangladesh area to coordinate choices.
 * @param {string} area - Area, district, or landmark text.
 * @returns {Promise<{results: object[]}>} Public area choices.
 * @sideEffects Calls the protected store-locator proxy.
 */
async function geocodeArea(area) {
  const response = await api.get("/store-locator/geocode", {
    params: { area },
  });
  return response.data.data;
}

/**
 * Finds publicly mapped shops near a user-approved coordinate.
 * @param {{latitude: number, longitude: number, radius: number, category: string}} options - Search centre and filters.
 * @returns {Promise<{stores: object[], count: number, mapNotice: string}>} Nearby map results.
 * @sideEffects Calls the protected OpenStreetMap proxy.
 */
async function findNearbyStores(options) {
  const response = await api.get("/store-locator/nearby", {
    params: options,
  });
  return response.data.data;
}

export const groceryRequestService = {
  listAssignments,
  createRequest,
  listCaregiverRequests,
  listFamilyRequests,
  reviewRequest,
  recordPurchase,
  updateStatus,
  uploadReceipt,
  updateSettlement,
  geocodeArea,
  findNearbyStores,
};
