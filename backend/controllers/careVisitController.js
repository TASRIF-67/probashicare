import mongoose from "mongoose";
import { Booking } from "../models/Booking.js";
import { CareTask } from "../models/CareTask.js";
import { VisitHandover } from "../models/VisitHandover.js";
import { ElderlyProfile } from "../models/ElderlyProfile.js";
import { ElderlyFamilyLink } from "../models/ElderlyFamilyLink.js";
import { getAuthorizedElderlyProfile } from "../services/elderlyProfileAccessService.js";
import { ApiError } from "../utils/ApiError.js";

function validationError(errors) {
  return new ApiError(422, "Please correct the care visit information.", errors);
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function normalizeTaskRecord(task) {
  return {
    ...task.toObject(),
    id: task._id.toString(),
    elderlyProfileId: task.elderlyProfileId?.toString?.() || task.elderlyProfileId,
    familyUserId: task.familyUserId?.toString?.() || task.familyUserId,
    caregiverUserId: task.caregiverUserId?.toString?.() || task.caregiverUserId,
    _id: undefined,
  };
}

function normalizeHandoverRecord(record) {
  return {
    ...record.toObject(),
    id: record._id.toString(),
    elderlyProfileId: record.elderlyProfileId?.toString?.() || record.elderlyProfileId,
    familyUserId: record.familyUserId?.toString?.() || record.familyUserId,
    caregiverUserId: record.caregiverUserId?.toString?.() || record.caregiverUserId,
    _id: undefined,
  };
}

async function ensureProfileAccessible(profileId, user) {
  if (user.role === "family") {
    const { profile } = await getAuthorizedElderlyProfile({
      profileId,
      familyUserId: user._id,
      permissions: ["owner", "editor", "viewer"],
    });
    return profile;
  }

  if (!mongoose.isValidObjectId(profileId)) {
    throw new ApiError(404, "Elderly profile not found.");
  }

  const profile = await ElderlyProfile.findOne({ _id: profileId, status: "active" });
  if (!profile) {
    throw new ApiError(404, "Elderly profile not found.");
  }

  return profile;
}

export async function listCareVisitTasks(request, response) {
  const profileId = String(request.query.elderlyProfileId || "").trim();
  if (!mongoose.isValidObjectId(profileId)) {
    throw new ApiError(404, "Elderly profile not found.");
  }

  await ensureProfileAccessible(profileId, request.user);

  const query = {
    elderlyProfileId: profileId,
  };

  if (request.user.role === "caregiver") {
    query.caregiverUserId = request.user._id;
  }

  const tasks = await CareTask.find(query).sort({ visitDate: -1, priority: 1, createdAt: -1 });

  response.json({
    success: true,
    data: {
      count: tasks.length,
      tasks: tasks.map(normalizeTaskRecord),
    },
  });
}

export async function createCareTask(request, response) {
  const body = request.body || {};
  const errors = {};
  const title = String(body.title || "").trim();
  const instructions = String(body.instructions || "").trim();
  const priority = String(body.priority || "medium").trim().toLowerCase();
  const visitDate = normalizeDate(body.visitDate || null);
  const elderlyProfileId = String(body.elderlyProfileId || "").trim();
  const caregiverUserId = String(body.caregiverUserId || "").trim();
  const bookingId = String(body.bookingId || "").trim();

  if (!mongoose.isValidObjectId(elderlyProfileId)) {
    errors.elderlyProfileId = "Select an elderly profile.";
  }
  if (!mongoose.isValidObjectId(caregiverUserId)) {
    errors.caregiverUserId = "Choose the caregiver assigned to this visit.";
  }
  if (!title) {
    errors.title = "Add a task title.";
  }
  if (!["low", "medium", "high"].includes(priority)) {
    errors.priority = "Choose low, medium, or high priority.";
  }
  if (body.instructions && instructions.length > 1000) {
    errors.instructions = "Instructions must be fewer than 1000 characters.";
  }
  if (visitDate && visitDate < new Date(Date.now() - 1000 * 60 * 60 * 24)) {
    errors.visitDate = "Select a future or current visit date.";
  }

  if (Object.keys(errors).length) {
    throw validationError(errors);
  }

  const profile = await ensureProfileAccessible(elderlyProfileId, request.user);

  const caregiverExists = await Booking.exists({
    familyMemberId: request.user._id,
    caregiverId: caregiverUserId,
    elderlyProfileId: profile._id,
    status: { $in: ["accepted", "confirmed"] },
  });

  if (!caregiverExists) {
    throw new ApiError(422, "That caregiver is not assigned to this elderly profile for an active visit.");
  }

  const task = await CareTask.create({
    elderlyProfileId: profile._id,
    familyUserId: request.user._id,
    caregiverUserId,
    bookingId: bookingId && mongoose.isValidObjectId(bookingId) ? bookingId : null,
    visitDate: visitDate || null,
    title,
    instructions,
    priority,
    status: "pending",
    lastUpdatedBy: "family",
  });

  response.status(201).json({
    success: true,
    data: {
      message: "Care visit task created.",
      task: normalizeTaskRecord(task),
    },
  });
}

export async function updateCareTask(request, response) {
  const taskId = request.params.taskId;
  const body = request.body || {};

  if (!mongoose.isValidObjectId(taskId)) {
    throw new ApiError(404, "Care task not found.");
  }

  const task = await CareTask.findOne({ _id: taskId, familyUserId: request.user._id });
  if (!task) {
    throw new ApiError(404, "Care task not found.");
  }

  const title = String(body.title ?? task.title).trim();
  const instructions = String(body.instructions ?? task.instructions).trim();
  const priority = String(body.priority ?? task.priority).trim().toLowerCase();
  const visitDate = normalizeDate(body.visitDate ?? task.visitDate);
  const caregiverUserId = String(body.caregiverUserId ?? task.caregiverUserId ?? "").trim();

  const errors = {};
  if (!title) errors.title = "Add a task title.";
  if (!mongoose.isValidObjectId(caregiverUserId)) errors.caregiverUserId = "Choose the caregiver assigned to this visit.";
  if (!["low", "medium", "high"].includes(priority)) errors.priority = "Choose low, medium, or high priority.";
  if (instructions.length > 1000) errors.instructions = "Instructions must be fewer than 1000 characters.";
  if (visitDate && visitDate < new Date(Date.now() - 1000 * 60 * 60 * 24)) errors.visitDate = "Select a future or current visit date.";

  if (Object.keys(errors).length) {
    throw validationError(errors);
  }

  const caregiverExists = await Booking.exists({
    familyMemberId: request.user._id,
    caregiverId: caregiverUserId,
    elderlyProfileId: task.elderlyProfileId,
    status: { $in: ["accepted", "confirmed"] },
  });

  if (!caregiverExists) {
    throw new ApiError(422, "That caregiver is not assigned to this elderly profile for an active visit.");
  }

  task.title = title;
  task.instructions = instructions;
  task.priority = priority;
  task.caregiverUserId = caregiverUserId;
  task.visitDate = visitDate || null;
  task.lastUpdatedBy = "family";
  await task.save();

  response.json({
    success: true,
    data: {
      message: "Care task updated.",
      task: normalizeTaskRecord(task),
    },
  });
}

export async function updateCareTaskStatus(request, response) {
  const taskId = request.params.taskId;
  const body = request.body || {};
  const status = String(body.status || "").trim().toLowerCase();
  const skipReason = String(body.skipReason || "").trim();

  if (!mongoose.isValidObjectId(taskId)) {
    throw new ApiError(404, "Care task not found.");
  }
  if (!["pending", "completed", "skipped"].includes(status)) {
    throw new ApiError(422, "Status must be pending, completed, or skipped.");
  }
  if (status === "skipped" && !skipReason) {
    throw new ApiError(422, "Add a reason when skipping a task.");
  }

  const task = await CareTask.findById(taskId);
  if (!task) {
    throw new ApiError(404, "Care task not found.");
  }

  if (task.caregiverUserId && task.caregiverUserId.toString() !== request.user._id.toString()) {
    throw new ApiError(403, "This task is assigned to another caregiver.");
  }

  task.caregiverUserId = request.user._id;
  task.status = status;
  task.skipReason = status === "skipped" ? skipReason : "";
  task.lastUpdatedBy = "caregiver";
  task.completedAt = status === "completed" ? new Date() : null;
  task.skippedAt = status === "skipped" ? new Date() : null;
  task.notes = body.notes ? String(body.notes).trim().slice(0, 500) : task.notes || "";
  await task.save();

  response.json({
    success: true,
    data: {
      message: "Task status updated.",
      task: normalizeTaskRecord(task),
    },
  });
}

export async function deleteCareTask(request, response) {
  const taskId = request.params.taskId;
  if (!mongoose.isValidObjectId(taskId)) {
    throw new ApiError(404, "Care task not found.");
  }

  const task = await CareTask.findOne({ _id: taskId, familyUserId: request.user._id });
  if (!task) {
    throw new ApiError(404, "Care task not found.");
  }

  await task.deleteOne();
  response.json({
    success: true,
    data: {
      message: "Care task removed.",
    },
  });
}

export async function listVisitHandovers(request, response) {
  const profileId = String(request.params.profileId || "").trim();
  if (!mongoose.isValidObjectId(profileId)) {
    throw new ApiError(404, "Handover not found.");
  }

  await ensureProfileAccessible(profileId, request.user);

  const handovers = await VisitHandover.find({ elderlyProfileId: profileId }).sort({ visitDate: -1, createdAt: -1 });

  response.json({
    success: true,
    data: {
      count: handovers.length,
      handovers: handovers.map(normalizeHandoverRecord),
    },
  });
}

export async function createVisitHandover(request, response) {
  const body = request.body || {};
  const errors = {};
  const elderlyProfileId = String(body.elderlyProfileId || "").trim();
  const summary = String(body.summary || "").trim();
  const visitDate = normalizeDate(body.visitDate);
  const mood = String(body.mood || "unknown").trim().toLowerCase();

  if (!mongoose.isValidObjectId(elderlyProfileId)) {
    errors.elderlyProfileId = "Select an elderly profile.";
  }
  if (!visitDate) {
    errors.visitDate = "Choose a visit date.";
  }
  if (!summary) {
    errors.summary = "Provide a final handover note.";
  }
  if (mood && !["good", "okay", "low", "concerned", "unknown"].includes(mood)) {
    errors.mood = "Choose a valid mood value.";
  }

  if (Object.keys(errors).length) {
    throw validationError(errors);
  }

  const profile = await ensureProfileAccessible(elderlyProfileId, request.user);
  const familyLink = await ElderlyFamilyLink.findOne({
    elderlyProfileId: profile._id,
    status: "active",
  }).sort({ createdAt: 1 });

  const handover = await VisitHandover.create({
    elderlyProfileId: profile._id,
    familyUserId: familyLink?.familyUserId || null,
    caregiverUserId: request.user._id,
    visitDate,
    mood,
    mealsEaten: String(body.mealsEaten || "").trim().slice(0, 300),
    incidents: String(body.incidents || "").trim().slice(0, 1000),
    summary: summary.slice(0, 2000),
    carePlanNotes: String(body.carePlanNotes || "").trim().slice(0, 1000),
    type: "final",
  });

  response.status(201).json({
    success: true,
    data: {
      message: "Handover note submitted.",
      handover: normalizeHandoverRecord(handover),
    },
  });
}
