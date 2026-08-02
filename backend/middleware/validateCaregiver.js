import { ApiError } from "../utils/ApiError.js";
import { WEEKDAYS } from "../models/CaregiverProfile.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+\d][\d\s()-]{5,29}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Validates and normalizes public caregiver signup input.
 * @param {import("express").Request} request - Request with name, email, phone, password, and confirmation.
 * @param {import("express").Response} _response - Express response, unused.
 * @param {import("express").NextFunction} next - Middleware continuation.
 * @returns {void}
 * @sideEffects Normalizes request body or forwards a 422 validation error.
 */
export function validateCaregiverSignup(request, _response, next) {
  const name = request.body?.name?.trim();
  const email = request.body?.email?.trim().toLowerCase();
  const phone = request.body?.phone?.trim();
  const password = request.body?.password;
  const confirmPassword = request.body?.confirmPassword;
  const errors = {};

  if (!name || name.length > 100) errors.name = "Name must be between 1 and 100 characters.";
  if (!email || !EMAIL_PATTERN.test(email)) errors.email = "Enter a valid email address.";
  if (!phone || !PHONE_PATTERN.test(phone)) errors.phone = "Enter a valid phone number.";
  if (typeof password !== "string" || password.length < 8) errors.password = "Password must contain at least 8 characters.";
  if (password !== confirmPassword) errors.confirmPassword = "Passwords do not match.";

  if (Object.keys(errors).length) {
    next(new ApiError(422, "Please correct the highlighted fields.", errors));
    return;
  }
  request.body = { name, email, phone, password, confirmPassword };
  next();
}

/**
 * Validates caregiver application fields, with stricter checks for final submission.
 * @param {Record<string, unknown>} body - Draft or submission payload.
 * @param {{isSubmission?: boolean, hasDocument?: boolean, requireDocument?: boolean}} [options] - Validation strictness and document policy/state.
 * @returns {Record<string, unknown>} Normalized application fields safe to assign.
 * @sideEffects Throws a 422 ApiError when validation fails.
 */
export function validateCaregiverApplication(
  body = {},
  { isSubmission = false, hasDocument = false, requireDocument = true } = {},
) {
  const skillInput = Array.isArray(body.skills) ? body.skills : [];
  const languageInput = Array.isArray(body.languages) ? body.languages : [];
  const normalized = {
    phone: body.phone?.trim() || "",
    bio: body.bio?.trim() || "",
    skills: [...new Set(skillInput.map((item) => String(item).trim()).filter(Boolean))],
    languages: [...new Set(languageInput.map((item) => String(item).trim()).filter(Boolean))],
    yearsOfExperience: body.yearsOfExperience === "" || body.yearsOfExperience == null ? null : Number(body.yearsOfExperience),
    hourlyRate: body.hourlyRate === "" || body.hourlyRate == null ? null : Number(body.hourlyRate),
    monthlyRate: body.monthlyRate === "" || body.monthlyRate == null ? null : Number(body.monthlyRate),
    serviceArea: body.serviceArea?.trim() || "",
    availability: Array.isArray(body.availability) ? body.availability : [],
  };
  const errors = {};

  if (normalized.phone && !PHONE_PATTERN.test(normalized.phone)) errors.phone = "Enter a valid phone number.";
  if (normalized.bio.length > 1000) errors.bio = "Bio cannot exceed 1000 characters.";
  if (!Array.isArray(body.skills)) errors.skills = "Skills must be submitted as a list.";
  if (!Array.isArray(body.languages)) errors.languages = "Languages must be submitted as a list.";
  if (normalized.skills.length > 30 || normalized.skills.some((item) => item.length > 80)) errors.skills = "Add no more than 30 skills, using 80 characters or fewer for each.";
  if (normalized.languages.length > 20 || normalized.languages.some((item) => item.length > 80)) errors.languages = "Add no more than 20 languages, using 80 characters or fewer for each.";
  if (normalized.serviceArea.length > 300) errors.serviceArea = "Service area cannot exceed 300 characters.";
  if (normalized.availability.length > 21) errors.availability = "Add no more than 21 availability periods.";
  if (normalized.yearsOfExperience != null && (!Number.isFinite(normalized.yearsOfExperience) || normalized.yearsOfExperience < 0 || normalized.yearsOfExperience > 60)) errors.yearsOfExperience = "Experience must be between 0 and 60 years.";
  if (normalized.hourlyRate != null && (!Number.isFinite(normalized.hourlyRate) || normalized.hourlyRate < 0)) errors.hourlyRate = "Hourly rate cannot be negative.";
  if (normalized.monthlyRate != null && (!Number.isFinite(normalized.monthlyRate) || normalized.monthlyRate < 0)) errors.monthlyRate = "Monthly rate cannot be negative.";

  normalized.availability.forEach((entry, index) => {
    if (!WEEKDAYS.includes(entry.day)) errors[`availability.${index}.day`] = "Choose a valid day.";
    if (!TIME_PATTERN.test(entry.startTime || "")) errors[`availability.${index}.startTime`] = "Choose a valid start time.";
    if (!TIME_PATTERN.test(entry.endTime || "")) errors[`availability.${index}.endTime`] = "Choose a valid end time.";
    if (TIME_PATTERN.test(entry.startTime || "") && TIME_PATTERN.test(entry.endTime || "") && entry.startTime >= entry.endTime) errors[`availability.${index}.endTime`] = "End time must be after start time.";
  });
  for (let left = 0; left < normalized.availability.length; left += 1) {
    for (let right = left + 1; right < normalized.availability.length; right += 1) {
      const first = normalized.availability[left];
      const second = normalized.availability[right];
      if (first.day === second.day && first.startTime < second.endTime && second.startTime < first.endTime) {
        errors[`availability.${right}.startTime`] = "Availability periods cannot overlap.";
      }
    }
  }

  if (isSubmission) {
    if (!normalized.phone) errors.phone = "Phone is required.";
    if (!normalized.bio) errors.bio = "Bio is required.";
    if (!normalized.skills.length) errors.skills = "Add at least one skill.";
    if (!normalized.languages.length) errors.languages = "Add at least one language.";
    if (normalized.yearsOfExperience == null) errors.yearsOfExperience = "Years of experience is required.";
    if (normalized.hourlyRate == null) errors.hourlyRate = "Hourly rate is required.";
    if (normalized.monthlyRate == null) errors.monthlyRate = "Monthly rate is required.";
    if (!normalized.serviceArea) errors.serviceArea = "Service area is required.";
    if (!normalized.availability.length) errors.availability = "Add at least one availability period.";
    if (requireDocument && !hasDocument) errors.verificationDocument = "Upload a verification document before submitting.";
  }

  if (Object.keys(errors).length) {
    throw new ApiError(422, "Please correct the caregiver application.", errors);
  }
  return normalized;
}
