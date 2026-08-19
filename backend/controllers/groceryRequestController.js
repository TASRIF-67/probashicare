import mongoose from "mongoose";
import { ElderlyFamilyLink } from "../models/ElderlyFamilyLink.js";
import {
  GROCERY_FULFILLMENT_METHODS,
  GROCERY_PAYMENT_ARRANGEMENTS,
  GROCERY_REQUEST_STATUSES,
  GroceryRequest,
} from "../models/GroceryRequest.js";
import {
  getReportableCareAssignment,
  listReportableCareAssignments,
} from "../services/careAssignmentService.js";
import {
  createGroceryReceiptUrl,
  deleteGroceryReceipt,
  uploadGroceryReceipt,
} from "../services/cloudinaryService.js";
import { getAuthorizedElderlyProfile } from "../services/elderlyProfileAccessService.js";
import {
  createNotification,
  createNotificationsForUsers,
} from "../services/notificationService.js";
import { ApiError } from "../utils/ApiError.js";

const MAXIMUM_LIST_LIMIT = 100;
const ALLOWED_ITEM_CATEGORIES = [
  "grocery",
  "household",
  "personal-care",
  "pharmacy",
  "other",
];

/**
 * Parses bounded grocery-list pagination values.
 * @param {Record<string, unknown>} query - Request query with optional page and limit.
 * @returns {{page: number, limit: number, skip: number}} Safe pagination values.
 * @sideEffects Throws a 422 error for invalid supplied values.
 */
function parsePagination(query) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 3 : Number(query.limit);

  if (!Number.isInteger(page) || page < 1) {
    throw new ApiError(422, "Page must be a positive integer.");
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > MAXIMUM_LIST_LIMIT) {
    throw new ApiError(
      422,
      "Limit must be between 1 and " + MAXIMUM_LIST_LIMIT + ".",
    );
  }

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

/**
 * Validates and normalizes grocery item input without advanced transformation chains.
 * @param {unknown} input - Untrusted request items.
 * @returns {Array<{name: string, category: string, quantity: number, unit: string, notes: string}>} Safe grocery items.
 * @sideEffects Throws a 422 error when an item is missing or invalid.
 */
function validateItems(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 30) {
    throw new ApiError(422, "Add between 1 and 30 requested items.");
  }

  const items = [];

  for (const untrustedItem of input) {
    const name = String(untrustedItem?.name || "").trim();
    const category = String(untrustedItem?.category || "grocery").trim();
    const quantity = Number(untrustedItem?.quantity);
    const unit = String(untrustedItem?.unit || "").trim();
    const notes = String(untrustedItem?.notes || "").trim();

    if (!name || name.length > 120) {
      throw new ApiError(
        422,
        "Each requested item needs a name of at most 120 characters.",
      );
    }

    if (!ALLOWED_ITEM_CATEGORIES.includes(category)) {
      throw new ApiError(422, "Choose a valid category for every item.");
    }

    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000) {
      throw new ApiError(422, "Each item quantity must be greater than zero.");
    }

    if (!unit || unit.length > 30) {
      throw new ApiError(
        422,
        "Each requested item needs a unit of at most 30 characters.",
      );
    }

    if (notes.length > 300) {
      throw new ApiError(422, "Item notes cannot exceed 300 characters.");
    }

    items.push({
      name,
      category,
      quantity,
      unit,
      notes,
    });
  }

  return items;
}

/**
 * Validates an optional BDT money value.
 * @param {unknown} value - Untrusted money value.
 * @param {string} fieldLabel - Human-readable validation field name.
 * @param {boolean} required - Whether a missing value is invalid.
 * @returns {number|null} Safe non-negative amount or null.
 * @sideEffects Throws a 422 error for invalid amounts.
 */
function validateMoney(value, fieldLabel, required) {
  if (value === undefined || value === null || value === "") {
    if (required) {
      throw new ApiError(422, fieldLabel + " is required.");
    }

    return null;
  }

  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0 || amount > 10000000) {
    throw new ApiError(422, fieldLabel + " must be a valid BDT amount.");
  }

  return amount;
}

/**
 * Validates and normalizes an optional selected-store snapshot.
 * @param {unknown} input - Untrusted map or manual store input.
 * @returns {object|null} Safe store snapshot or null.
 * @sideEffects Throws a 422 error for invalid coordinates or long text.
 */
function validateStore(input) {
  if (!input) {
    return null;
  }

  const source = String(input.source || "manual");
  const allowedSources = [
    "openstreetmap",
    "manual",
    "external-provider",
  ];

  if (!allowedSources.includes(source)) {
    throw new ApiError(422, "Choose a valid store source.");
  }

  const store = {
    source,
    externalId: String(input.externalId || "").trim().slice(0, 100),
    name: String(input.name || "").trim().slice(0, 160),
    category: String(input.category || "").trim().slice(0, 80),
    address: String(input.address || "").trim().slice(0, 400),
    phone: String(input.phone || "").trim().slice(0, 50),
    latitude: null,
    longitude: null,
  };

  if (input.latitude !== undefined && input.latitude !== null) {
    store.latitude = Number(input.latitude);
  }

  if (input.longitude !== undefined && input.longitude !== null) {
    store.longitude = Number(input.longitude);
  }

  if (
    store.latitude !== null
    && (!Number.isFinite(store.latitude)
      || store.latitude < -90
      || store.latitude > 90)
  ) {
    throw new ApiError(422, "Store latitude is invalid.");
  }

  if (
    store.longitude !== null
    && (!Number.isFinite(store.longitude)
      || store.longitude < -180
      || store.longitude > 180)
  ) {
    throw new ApiError(422, "Store longitude is invalid.");
  }

  return store;
}

/**
 * Adds safe identity fields to a grocery request query.
 * @param {import("mongoose").Query} query - GroceryRequest query.
 * @returns {import("mongoose").Query} Query with selected identities populated.
 * @sideEffects Configures the query before execution.
 */
function populateRequest(query) {
  return query
    .populate("caregiverUserId", "name")
    .populate(
      "elderlyProfileId",
      "personalInformation.fullName personalInformation.preferredName",
    );
}

/**
 * Converts a populated grocery request into the shared API response.
 * @param {import("mongoose").Document} requestDocument - Authorized grocery request.
 * @returns {object} Grocery request with safe identities and optional signed receipt.
 * @sideEffects Signs a short-lived receipt URL locally when configured.
 */
function formatRequest(requestDocument) {
  const value = requestDocument.toObject();
  const caregiver = value.caregiverUserId;
  const elderly = value.elderlyProfileId;
  let caregiverSummary = null;
  let elderlySummary = null;
  let caregiverUserId = caregiver;
  let elderlyProfileId = elderly;
  let receipt = null;

  if (caregiver?._id) {
    caregiverUserId = caregiver._id;
    caregiverSummary = {
      id: caregiver._id,
      name: caregiver.name,
    };
  }

  if (elderly?._id) {
    elderlyProfileId = elderly._id;
    elderlySummary = {
      id: elderly._id,
      name: elderly.personalInformation?.preferredName
        || elderly.personalInformation?.fullName
        || "Care recipient",
    };
  }

  if (value.receipt) {
    receipt = {
      originalName: value.receipt.originalName,
      bytes: value.receipt.bytes,
      uploadedAt: value.receipt.uploadedAt,
    };
  }

  const receiptUrl = createGroceryReceiptUrl(value.receipt);
  delete value.receipt;

  return {
    ...value,
    caregiverUserId,
    elderlyProfileId,
    caregiver: caregiverSummary,
    elderly: elderlySummary,
    receipt,
    receiptUrl,
  };
}

/**
 * Finds actively linked family recipients for an elderly profile.
 * @param {string|import("mongoose").Types.ObjectId} elderlyProfileId - Elderly profile ID.
 * @returns {Promise<Array<import("mongoose").Types.ObjectId>>} Linked family user IDs.
 * @sideEffects Reads active ElderlyFamilyLink records.
 */
async function getFamilyRecipientIds(elderlyProfileId) {
  const links = await ElderlyFamilyLink.find({
    elderlyProfileId,
    status: "active",
  }).select("familyUserId");
  const recipientIds = [];

  for (const link of links) {
    recipientIds.push(link.familyUserId);
  }

  return recipientIds;
}

/**
 * Loads a grocery request only when the family has required elderly permission.
 * @param {{requestId: string, familyUserId: string|import("mongoose").Types.ObjectId, permissions?: string[]}} input - Request and access rule.
 * @returns {Promise<import("mongoose").Document>} Authorized grocery request.
 * @sideEffects Reads GroceryRequest and ElderlyFamilyLink data; conceals failures as 404.
 */
async function getFamilyAuthorizedRequest({
  requestId,
  familyUserId,
  permissions = ["owner", "editor", "viewer"],
}) {
  if (!mongoose.isValidObjectId(requestId)) {
    throw new ApiError(404, "Grocery request not found.");
  }

  const requestDocument = await GroceryRequest.findById(requestId);

  if (!requestDocument) {
    throw new ApiError(404, "Grocery request not found.");
  }

  await getAuthorizedElderlyProfile({
    profileId: requestDocument.elderlyProfileId.toString(),
    familyUserId,
    permissions,
  });

  return requestDocument;
}

/**
 * Sends one grocery event notification to every linked family account.
 * @param {{requestDocument: import("mongoose").Document, actorUserId: string|import("mongoose").Types.ObjectId, type: string, title: string, message: string, eventSuffix: string}} input - Grocery notification content.
 * @returns {Promise<void>}
 * @sideEffects Reads family links and creates idempotent notifications.
 */
async function notifyFamily(input) {
  const recipientUserIds = await getFamilyRecipientIds(
    input.requestDocument.elderlyProfileId,
  );

  await createNotificationsForUsers({
    recipientUserIds,
    actorUserId: input.actorUserId,
    type: input.type,
    priority: input.requestDocument.urgency === "urgent"
      ? "important"
      : "normal",
    title: input.title,
    message: input.message,
    actionPath: "/groceries",
    relatedEntityType: "grocery-request",
    relatedEntityId: input.requestDocument._id,
    eventKey:
      "grocery-request:"
      + input.requestDocument._id
      + ":"
      + input.eventSuffix,
  });
}

/**
 * Sends one grocery workflow notification to the requesting caregiver.
 * @param {{requestDocument: import("mongoose").Document, actorUserId: string|import("mongoose").Types.ObjectId, type: string, title: string, message: string, eventSuffix: string}} input - Caregiver notification content.
 * @returns {Promise<void>}
 * @sideEffects Creates one idempotent caregiver notification.
 */
async function notifyCaregiver(input) {
  await createNotification({
    recipientUserId: input.requestDocument.caregiverUserId,
    actorUserId: input.actorUserId,
    type: input.type,
    priority: "important",
    title: input.title,
    message: input.message,
    actionPath: "/caregiver/groceries",
    relatedEntityType: "grocery-request",
    relatedEntityId: input.requestDocument._id,
    eventKey:
      "grocery-request:"
      + input.requestDocument._id
      + ":"
      + input.eventSuffix,
  });
}

/**
 * GET /api/grocery-requests/assignments
 * Success returns assignment-backed elderly choices for an approved caregiver.
 * Auth: approved Caregiver. No request body, params, or query.
 * @param {import("express").Request} request - Authenticated caregiver request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads and may synchronize care assignments.
 */
export async function listGroceryAssignments(request, response) {
  const assignments = await listReportableCareAssignments(request.user._id);
  const result = [];

  for (const assignment of assignments) {
    if (!assignment.elderlyProfileId) {
      continue;
    }

    result.push({
      id: assignment._id,
      elderlyProfileId: assignment.elderlyProfileId._id,
      elderly: {
        id: assignment.elderlyProfileId._id,
        name: assignment.elderlyProfileId.personalInformation.preferredName
          || assignment.elderlyProfileId.personalInformation.fullName,
      },
      assignmentType: assignment.assignmentType,
      status: assignment.status,
      startsAt: assignment.startsAt,
      endsAt: assignment.endsAt,
    });
  }

  response.json({
    success: true,
    data: {
      assignments: result,
      count: result.length,
    },
  });
}

/**
 * POST /api/grocery-requests
 * Body: assignment/profile identity, one to thirty items, optional urgency,
 * needed-by date, caregiver note, and estimated BDT budget.
 * Success 201 returns the submitted request. Auth: approved Caregiver with a
 * matching reportable care assignment.
 * @param {import("express").Request} request - Caregiver grocery request input.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Creates one grocery request and notifies linked family accounts.
 */
export async function createGroceryRequest(request, response) {
  const careAssignmentId = String(request.body?.careAssignmentId || "");
  const elderlyProfileId = String(request.body?.elderlyProfileId || "");
  const items = validateItems(request.body?.items);
  const urgency = String(request.body?.urgency || "normal");
  const caregiverNote = String(request.body?.caregiverNote || "").trim();
  const estimatedBudget = validateMoney(
    request.body?.estimatedBudget,
    "Estimated budget",
    false,
  );

  if (urgency !== "normal" && urgency !== "urgent") {
    throw new ApiError(422, "Urgency must be normal or urgent.");
  }

  if (caregiverNote.length > 1000) {
    throw new ApiError(422, "Caregiver note cannot exceed 1000 characters.");
  }

  let neededBy = null;

  if (request.body?.neededBy) {
    neededBy = new Date(request.body.neededBy);

    if (Number.isNaN(neededBy.getTime())) {
      throw new ApiError(422, "Needed-by date is invalid.");
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    if (neededBy < startOfToday) {
      throw new ApiError(422, "Needed-by date cannot be in the past.");
    }
  }

  const assignment = await getReportableCareAssignment({
    assignmentId: careAssignmentId,
    caregiverUserId: request.user._id,
    elderlyProfileId,
  });
  const created = await GroceryRequest.create({
    elderlyProfileId,
    caregiverUserId: request.user._id,
    careAssignmentId: assignment._id,
    sourceBookingId: assignment.sourceBookingId || null,
    items,
    urgency,
    neededBy,
    caregiverNote,
    estimatedBudget,
    status: "submitted",
    statusHistory: [
      {
        status: "submitted",
        changedBy: request.user._id,
        changedByRole: "caregiver",
        note: "Request submitted for family review.",
      },
    ],
  });

  await notifyFamily({
    requestDocument: created,
    actorUserId: request.user._id,
    type: "grocery-request-submitted",
    title: urgency === "urgent"
      ? "Urgent essentials request"
      : "New essentials request",
    message: "A caregiver submitted grocery or essential items for approval.",
    eventSuffix: "submitted",
  });

  const populated = await populateRequest(
    GroceryRequest.findById(created._id),
  );
  response.status(201).json({
    success: true,
    data: {
      message: "Grocery request sent to the linked family.",
      request: formatRequest(populated),
    },
  });
}

/**
 * GET /api/grocery-requests/caregiver/mine
 * Query: page and limit. Success returns only the authenticated caregiver's
 * request history. Auth: approved Caregiver.
 * @param {import("express").Request} request - Caregiver list request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads and counts caregiver-owned grocery requests.
 */
export async function listCaregiverGroceryRequests(request, response) {
  const pagination = parsePagination(request.query);
  const filter = {
    caregiverUserId: request.user._id,
  };
  const [requests, total] = await Promise.all([
    populateRequest(
      GroceryRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit),
    ),
    GroceryRequest.countDocuments(filter),
  ]);
  const formattedRequests = [];

  for (const requestDocument of requests) {
    formattedRequests.push(formatRequest(requestDocument));
  }

  response.json({
    success: true,
    data: {
      requests: formattedRequests,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        pages: Math.ceil(total / pagination.limit),
      },
    },
  });
}

/**
 * GET /api/grocery-requests/family/mine
 * Query: page and limit. Success returns requests belonging to actively linked
 * elderly profiles. Auth: Family owner, editor, or viewer for each returned item.
 * @param {import("express").Request} request - Family list request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads family links and matching grocery requests.
 */
export async function listFamilyGroceryRequests(request, response) {
  const pagination = parsePagination(request.query);
  const links = await ElderlyFamilyLink.find({
    familyUserId: request.user._id,
    status: "active",
  }).select("elderlyProfileId permission");
  const profileIds = [];
  const permissionsByProfileId = {};

  for (const link of links) {
    profileIds.push(link.elderlyProfileId);
    permissionsByProfileId[link.elderlyProfileId.toString()] = link.permission;
  }

  const filter = {
    elderlyProfileId: {
      $in: profileIds,
    },
  };
  const [requests, total] = await Promise.all([
    populateRequest(
      GroceryRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit),
    ),
    GroceryRequest.countDocuments(filter),
  ]);
  const formattedRequests = [];

  for (const requestDocument of requests) {
    if (!requestDocument.elderlyProfileId) {
      continue;
    }

    const formatted = formatRequest(requestDocument);
    formatted.familyPermission =
      permissionsByProfileId[requestDocument.elderlyProfileId._id.toString()];
    formattedRequests.push(formatted);
  }

  response.json({
    success: true,
    data: {
      requests: formattedRequests,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        pages: Math.ceil(total / pagination.limit),
      },
    },
  });
}

/**
 * PATCH /api/grocery-requests/:requestId/review
 * Body: approve with fulfillment method and budget, or reject with a reason.
 * Success returns the concurrency-safe transition. Auth: Family owner/editor.
 * @param {import("express").Request} request - Family decision request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Updates one submitted request and notifies its caregiver.
 */
export async function reviewGroceryRequest(request, response) {
  const existing = await getFamilyAuthorizedRequest({
    requestId: request.params.requestId,
    familyUserId: request.user._id,
    permissions: ["owner", "editor"],
  });
  const decision = String(request.body?.decision || "");
  const note = String(request.body?.note || "").trim();

  if (decision !== "approve" && decision !== "reject") {
    throw new ApiError(422, "Decision must be approve or reject.");
  }

  if (existing.status !== "submitted") {
    throw new ApiError(409, "Only a submitted request can be reviewed.");
  }

  let nextStatus = "rejected";
  const updates = {
    familyDecisionNote: note,
    reviewedAt: new Date(),
  };

  if (decision === "approve") {
    const fulfillmentMethod = String(request.body?.fulfillmentMethod || "");

    if (!GROCERY_FULFILLMENT_METHODS.includes(fulfillmentMethod)) {
      throw new ApiError(422, "Choose who will purchase the approved items.");
    }

    updates.fulfillmentMethod = fulfillmentMethod;
    updates.approvedBudget = validateMoney(
      request.body?.approvedBudget,
      "Approved budget",
      true,
    );

    if (updates.approvedBudget <= 0) {
      throw new ApiError(422, "Approved budget must be greater than zero.");
    }
    nextStatus = "approved";
  } else if (note.length < 5) {
    throw new ApiError(422, "Give the caregiver a short rejection reason.");
  }

  const updated = await GroceryRequest.findOneAndUpdate(
    {
      _id: existing._id,
      status: "submitted",
    },
    {
      $set: {
        ...updates,
        status: nextStatus,
      },
      $push: {
        statusHistory: {
          status: nextStatus,
          changedBy: request.user._id,
          changedByRole: "family",
          note,
        },
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!updated) {
    throw new ApiError(409, "This request was already reviewed.");
  }

  await notifyCaregiver({
    requestDocument: updated,
    actorUserId: request.user._id,
    type: decision === "approve"
      ? "grocery-request-approved"
      : "grocery-request-rejected",
    title: decision === "approve"
      ? "Essentials request approved"
      : "Essentials request rejected",
    message: decision === "approve"
      ? "The family approved your grocery and essentials request."
      : "The family rejected your grocery and essentials request.",
    eventSuffix: nextStatus,
  });

  const populated = await populateRequest(
    GroceryRequest.findById(updated._id),
  );
  response.json({
    success: true,
    data: {
      message: "Grocery request " + nextStatus + ".",
      request: formatRequest(populated),
    },
  });
}

/**
 * PATCH /api/grocery-requests/:requestId/purchase
 * Body: actual BDT total, payment arrangement, optional store, reference and
 * note. Caregiver records local purchases; Family records remote orders.
 * @param {import("express").Request} request - Authorized purchase details.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Updates purchase data and notifies the other participant group.
 */
export async function recordGroceryPurchase(request, response) {
  let existing;
  let nextStatus;

  if (request.user.role === "caregiver") {
    if (!mongoose.isValidObjectId(request.params.requestId)) {
      throw new ApiError(404, "Grocery request not found.");
    }

    existing = await GroceryRequest.findOne({
      _id: request.params.requestId,
      caregiverUserId: request.user._id,
    });

    if (!existing) {
      throw new ApiError(404, "Grocery request not found.");
    }

    if (existing.fulfillmentMethod !== "caregiver-purchase") {
      throw new ApiError(409, "The family chose to place this order remotely.");
    }

    if (!["approved", "purchasing"].includes(existing.status)) {
      throw new ApiError(409, "This request is not ready for purchase details.");
    }

    nextStatus = "purchased";
  } else {
    existing = await getFamilyAuthorizedRequest({
      requestId: request.params.requestId,
      familyUserId: request.user._id,
      permissions: ["owner", "editor"],
    });

    if (existing.fulfillmentMethod !== "family-remote-order") {
      throw new ApiError(409, "The caregiver is assigned to purchase these items.");
    }

    if (existing.status !== "approved") {
      throw new ApiError(409, "This request is not ready for remote order details.");
    }

    nextStatus = "ordered";
  }

  const actualTotal = validateMoney(
    request.body?.actualTotal,
    "Actual total",
    true,
  );

  if (actualTotal <= 0) {
    throw new ApiError(422, "Actual total must be greater than zero.");
  }
  const paymentArrangement = String(
    request.body?.paymentArrangement || "",
  );

  if (!GROCERY_PAYMENT_ARRANGEMENTS.includes(paymentArrangement)) {
    throw new ApiError(422, "Choose how the purchase payment was arranged.");
  }

  const purchaseNote = String(request.body?.purchaseNote || "").trim();
  const externalOrderReference = String(
    request.body?.externalOrderReference || "",
  ).trim();

  if (purchaseNote.length > 1000 || externalOrderReference.length > 160) {
    throw new ApiError(422, "Purchase notes or reference are too long.");
  }

  const selectedStore = validateStore(request.body?.selectedStore);
  const allowedCurrentStatuses = request.user.role === "caregiver"
    ? ["approved", "purchasing"]
    : ["approved"];
  const updated = await GroceryRequest.findOneAndUpdate(
    {
      _id: existing._id,
      status: {
        $in: allowedCurrentStatuses,
      },
    },
    {
      $set: {
        actualTotal,
        paymentArrangement,
        purchaseNote,
        externalOrderReference,
        selectedStore,
        status: nextStatus,
        purchasedAt: new Date(),
      },
      $push: {
        statusHistory: {
          status: nextStatus,
          changedBy: request.user._id,
          changedByRole: request.user.role,
          note: purchaseNote,
        },
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!updated) {
    throw new ApiError(409, "The request status changed before purchase was saved.");
  }

  if (request.user.role === "caregiver") {
    await notifyFamily({
      requestDocument: updated,
      actorUserId: request.user._id,
      type: "grocery-purchase-updated",
      title: "Essentials purchased",
      message: "The caregiver recorded the completed local purchase.",
      eventSuffix: "purchased",
    });
  } else {
    await notifyCaregiver({
      requestDocument: updated,
      actorUserId: request.user._id,
      type: "grocery-purchase-updated",
      title: "Remote essentials order placed",
      message: "The family placed the approved grocery or essentials order.",
      eventSuffix: "ordered",
    });
  }

  const populated = await populateRequest(
    GroceryRequest.findById(updated._id),
  );
  response.json({
    success: true,
    data: {
      message: nextStatus === "purchased"
        ? "Local purchase recorded."
        : "Remote order recorded.",
      request: formatRequest(populated),
    },
  });
}

/**
 * PATCH /api/grocery-requests/:requestId/status
 * Body: the next permitted operational status and optional note. Transitions
 * differ by role and fulfillment method. Exact current-status matching prevents
 * conflicting concurrent updates.
 * @param {import("express").Request} request - Caregiver or family transition request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Updates status, writes audit history, and sends notifications.
 */
export async function updateGroceryRequestStatus(request, response) {
  const nextStatus = String(request.body?.status || "");
  const note = String(request.body?.note || "").trim();
  let existing;

  if (!GROCERY_REQUEST_STATUSES.includes(nextStatus)) {
    throw new ApiError(422, "Choose a valid grocery request status.");
  }

  if (request.user.role === "caregiver") {
    if (!mongoose.isValidObjectId(request.params.requestId)) {
      throw new ApiError(404, "Grocery request not found.");
    }

    existing = await GroceryRequest.findOne({
      _id: request.params.requestId,
      caregiverUserId: request.user._id,
    });
  } else {
    existing = await getFamilyAuthorizedRequest({
      requestId: request.params.requestId,
      familyUserId: request.user._id,
      permissions: ["owner", "editor"],
    });
  }

  if (!existing) {
    throw new ApiError(404, "Grocery request not found.");
  }

  let transitionAllowed = false;

  if (request.user.role === "caregiver") {
    if (existing.status === "submitted" && nextStatus === "cancelled") {
      transitionAllowed = true;
    } else if (
      existing.status === "approved"
      && existing.fulfillmentMethod === "caregiver-purchase"
      && nextStatus === "purchasing"
    ) {
      transitionAllowed = true;
    } else if (
      ["purchased", "out-for-delivery"].includes(existing.status)
      && nextStatus === "delivered"
    ) {
      transitionAllowed = true;
    }
  } else if (existing.status === "approved" && nextStatus === "cancelled") {
    transitionAllowed = true;
  } else if (existing.status === "ordered" && nextStatus === "out-for-delivery") {
    transitionAllowed = true;
  } else if (
    ["purchased", "out-for-delivery"].includes(existing.status)
    && nextStatus === "delivered"
  ) {
    transitionAllowed = true;
  }

  if (!transitionAllowed) {
    throw new ApiError(
      409,
      "A " + existing.status + " request cannot be marked " + nextStatus + ".",
    );
  }

  const updates = {
    status: nextStatus,
  };

  if (nextStatus === "delivered") {
    updates.deliveredAt = new Date();
  }

  const updated = await GroceryRequest.findOneAndUpdate(
    {
      _id: existing._id,
      status: existing.status,
    },
    {
      $set: updates,
      $push: {
        statusHistory: {
          status: nextStatus,
          changedBy: request.user._id,
          changedByRole: request.user.role,
          note,
        },
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!updated) {
    throw new ApiError(409, "The request status changed before your update.");
  }

  if (request.user.role === "caregiver") {
    await notifyFamily({
      requestDocument: updated,
      actorUserId: request.user._id,
      type: "grocery-delivery-updated",
      title: "Essentials status updated",
      message: "The caregiver marked the request " + nextStatus.replaceAll("-", " ") + ".",
      eventSuffix: nextStatus,
    });
  } else {
    await notifyCaregiver({
      requestDocument: updated,
      actorUserId: request.user._id,
      type: "grocery-delivery-updated",
      title: "Essentials status updated",
      message: "The family marked the request " + nextStatus.replaceAll("-", " ") + ".",
      eventSuffix: nextStatus,
    });
  }

  const populated = await populateRequest(
    GroceryRequest.findById(updated._id),
  );
  response.json({
    success: true,
    data: {
      message: "Grocery request marked " + nextStatus + ".",
      request: formatRequest(populated),
    },
  });
}

/**
 * POST /api/grocery-requests/:requestId/receipt
 * Multipart field: optional evidence file named receipt. Family owner/editor or
 * the assigned caregiver may upload after a purchase/order is recorded.
 * @param {import("express").Request} request - Authorized multipart upload request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Uploads a private receipt, replaces old evidence, and updates MongoDB.
 */
export async function uploadRequestReceipt(request, response) {
  if (!request.file) {
    throw new ApiError(422, "Choose a receipt file to upload.");
  }

  let existing;

  if (request.user.role === "caregiver") {
    if (!mongoose.isValidObjectId(request.params.requestId)) {
      throw new ApiError(404, "Grocery request not found.");
    }

    existing = await GroceryRequest.findOne({
      _id: request.params.requestId,
      caregiverUserId: request.user._id,
    });
  } else {
    existing = await getFamilyAuthorizedRequest({
      requestId: request.params.requestId,
      familyUserId: request.user._id,
      permissions: ["owner", "editor"],
    });
  }

  if (!existing) {
    throw new ApiError(404, "Grocery request not found.");
  }

  if (
    !["purchased", "ordered", "out-for-delivery", "delivered"].includes(
      existing.status,
    )
  ) {
    throw new ApiError(
      409,
      "A receipt can be added after purchase or order details are recorded.",
    );
  }

  const previousReceipt = existing.receipt?.publicId
    ? existing.receipt.toObject()
    : null;
  const receipt = await uploadGroceryReceipt({
    buffer: request.file.buffer,
    mimetype: request.file.mimetype,
    originalname: request.file.originalname,
    requestId: existing._id.toString(),
  });

  existing.receipt = receipt;
  await existing.save();

  if (previousReceipt) {
    await deleteGroceryReceipt(previousReceipt);
  }

  const populated = await populateRequest(
    GroceryRequest.findById(existing._id),
  );
  response.json({
    success: true,
    data: {
      message: "Optional purchase receipt uploaded.",
      request: formatRequest(populated),
    },
  });
}

/**
 * PATCH /api/grocery-requests/:requestId/payment-settled
 * Body contains a settled boolean. Family owner/editor records reimbursement or
 * payment settlement without claiming ProbashiCare transferred money.
 * @param {import("express").Request} request - Family settlement request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Updates the request payment audit flag.
 */
export async function updatePaymentSettlement(request, response) {
  const existing = await getFamilyAuthorizedRequest({
    requestId: request.params.requestId,
    familyUserId: request.user._id,
    permissions: ["owner", "editor"],
  });

  if (typeof request.body?.settled !== "boolean") {
    throw new ApiError(422, "Settlement value must be true or false.");
  }

  if (existing.actualTotal === null) {
    throw new ApiError(409, "Record purchase details before payment settlement.");
  }

  existing.paymentSettled = request.body.settled;
  await existing.save();

  const populated = await populateRequest(
    GroceryRequest.findById(existing._id),
  );
  response.json({
    success: true,
    data: {
      message: request.body.settled
        ? "Payment marked settled."
        : "Payment marked unsettled.",
      request: formatRequest(populated),
    },
  });
}