import {
  BLOOD_SUGAR_CONTEXTS,
  MEAL_STATUSES,
  MEDICINE_INTAKE_STATUSES,
  MOOD_OPTIONS,
} from "../models/WellnessReport.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Converts an optional form number into a finite numeric value or null.
 * @param {unknown} value - Raw input from a JSON form payload.
 * @returns {number|null} Normalized finite number or null when omitted.
 * @sideEffects None.
 */
function optionalNumber(value) {
  if (value === "" || value == null) {
    return null;
  }

  const number = Number(value);

  if (Number.isFinite(number)) {
    return number;
  }

  return Number.NaN;
}

/**
 * Converts an optional input into a valid Date or null while recording field errors.
 * @param {unknown} value - Raw date-compatible value.
 * @param {string} field - Field path used in validation feedback.
 * @param {Record<string, string>} errors - Mutable validation error collection.
 * @returns {Date|null} Parsed date or null when omitted/invalid.
 * @sideEffects Adds a field entry to `errors` when parsing fails.
 */
function optionalDate(value, field, errors) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    errors[field] = "Enter a valid date and time.";
    return null;
  }
  return date;
}

/**
 * Validates and normalizes a caregiver wellness-report draft or final submission.
 * @param {Record<string, unknown>} body - Report form payload.
 * @param {{isSubmission?: boolean}} [options] - Enables required final-report checks.
 * @returns {Record<string, unknown>} Normalized fields safe to assign to WellnessReport.
 * @sideEffects Throws a 422 ApiError containing field-level validation details.
 */
export function validateWellnessReportPayload(body = {}, { isSubmission = false } = {}) {
  const errors = {};
  let vitalsInput = {};

  if (body.vitals && typeof body.vitals === "object") {
    vitalsInput = body.vitals;
  }

  const visitDate = optionalDate(body.visitDate, "visitDate", errors);
  const checkInAt = optionalDate(body.checkInAt, "checkInAt", errors);
  const checkOutAt = optionalDate(body.checkOutAt, "checkOutAt", errors);
  const nextVisitDate = optionalDate(body.nextVisitDate, "nextVisitDate", errors);
  const measuredAt = optionalDate(vitalsInput.measuredAt, "vitals.measuredAt", errors);
  const normalized = {
    careAssignmentId: String(body.careAssignmentId || "").trim(),
    elderlyProfileId: String(body.elderlyProfileId || "").trim(),
    visitDate,
    checkInAt,
    checkOutAt,
    mood: body.mood || null,
    mealStatus: body.mealStatus || null,
    mealNotes: String(body.mealNotes || "").trim(),
    medicineIntakeStatus: body.medicineIntakeStatus || null,
    medicineNotes: String(body.medicineNotes || "").trim(),
    vitals: {
      systolic: optionalNumber(vitalsInput.systolic),
      diastolic: optionalNumber(vitalsInput.diastolic),
      bloodSugar: optionalNumber(vitalsInput.bloodSugar),
      bloodSugarContext: vitalsInput.bloodSugarContext || "unknown",
      weightKg: optionalNumber(vitalsInput.weightKg),
      measuredAt,
    },
    exerciseDurationMinutes: optionalNumber(body.exerciseDurationMinutes),
    observations: String(body.observations || "").trim(),
    caregiverNotes: String(body.caregiverNotes || "").trim(),
    nextVisitDate,
  };

  if (!normalized.careAssignmentId) {
    errors.careAssignmentId = "Choose an assigned visit.";
  }
  if (!normalized.elderlyProfileId) {
    errors.elderlyProfileId = "Choose an elderly profile.";
  }
  if (!visitDate) {
    errors.visitDate = errors.visitDate || "Visit date is required.";
  }
  if (normalized.mood && !MOOD_OPTIONS.includes(normalized.mood)) {
    errors.mood = "Choose a valid mood.";
  }
  if (normalized.mealStatus && !MEAL_STATUSES.includes(normalized.mealStatus)) {
    errors.mealStatus = "Choose a valid meal status.";
  }
  if (
    normalized.medicineIntakeStatus &&
    !MEDICINE_INTAKE_STATUSES.includes(normalized.medicineIntakeStatus)
  ) {
    errors.medicineIntakeStatus = "Choose a valid medicine status.";
  }
  if (!BLOOD_SUGAR_CONTEXTS.includes(normalized.vitals.bloodSugarContext)) {
    errors["vitals.bloodSugarContext"] = "Choose a valid blood sugar context.";
  }

  const numericRules = [
    ["vitals.systolic", normalized.vitals.systolic, 50, 260],
    ["vitals.diastolic", normalized.vitals.diastolic, 30, 180],
    ["vitals.bloodSugar", normalized.vitals.bloodSugar, 20, 600],
    ["vitals.weightKg", normalized.vitals.weightKg, 20, 300],
    ["exerciseDurationMinutes", normalized.exerciseDurationMinutes, 0, 600],
  ];
  // Each rule contains the field name, current value, minimum, and maximum.
  for (const [field, value, minimum, maximum] of numericRules) {
    if (value != null && (!Number.isFinite(value) || value < minimum || value > maximum)) {
      errors[field] = `Enter a value between ${minimum} and ${maximum}.`;
    }
  }

  const hasSystolic = normalized.vitals.systolic != null;
  const hasDiastolic = normalized.vitals.diastolic != null;
  if (hasSystolic !== hasDiastolic) {
    errors[hasSystolic ? "vitals.diastolic" : "vitals.systolic"] =
      "Record both blood pressure values together.";
  }
  const possibleVitals = [
    normalized.vitals.systolic,
    normalized.vitals.bloodSugar,
    normalized.vitals.weightKg,
  ];
  let hasVitals = false;

  for (const value of possibleVitals) {
    if (value != null) {
      hasVitals = true;
      break;
    }
  }
  if (hasVitals && !normalized.vitals.measuredAt) {
    errors["vitals.measuredAt"] = "Add the time when the vitals were measured.";
  }
  if (normalized.vitals.bloodSugar != null && !vitalsInput.bloodSugarContext) {
    errors["vitals.bloodSugarContext"] = "Choose when blood sugar was measured.";
  }
  if (checkInAt && checkOutAt && checkOutAt <= checkInAt) {
    errors.checkOutAt = "Check-out time must be after check-in time.";
  }
  if (visitDate && visitDate.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
    errors.visitDate = "Visit date cannot be more than one day in the future.";
  }

  const lengthRules = [
    ["mealNotes", normalized.mealNotes, 500],
    ["medicineNotes", normalized.medicineNotes, 500],
    ["observations", normalized.observations, 2000],
    ["caregiverNotes", normalized.caregiverNotes, 1500],
  ];
  for (const [field, value, maximum] of lengthRules) {
    if (value.length > maximum) {
      errors[field] = `Use ${maximum} characters or fewer.`;
    }
  }

  if (isSubmission) {
    if (!checkInAt) {
      errors.checkInAt = "Check-in time is required before submission.";
    }
    if (!normalized.mood) {
      errors.mood = "Mood is required before submission.";
    }
    if (!normalized.mealStatus) {
      errors.mealStatus = "Meal status is required before submission.";
    }
    if (!normalized.medicineIntakeStatus) {
      errors.medicineIntakeStatus = "Medicine status is required before submission.";
    }
    if (!normalized.observations) {
      errors.observations = "Add a brief health observation.";
    }
  }

  if (Object.keys(errors).length) {
    throw new ApiError(422, "Please correct the wellness report.", errors);
  }
  return normalized;
}
