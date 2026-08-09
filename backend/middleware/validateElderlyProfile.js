import { ApiError } from "../utils/ApiError.js";

const PHONE_PATTERN = /^[+\d][\d\s()-]{5,29}$/;
const MAX_SECTION_ITEMS = 50;
const PROFILE_SECTION_NAMES = [
  "medicalHistory",
  "allergies",
  "medications",
  "chronicDiseases",
  "emergencyContacts",
];

/**
 * Validates required identity, location, relationship, date, and phone fields.
 * @param {Record<string, unknown>|undefined} personal - Personal-information request section.
 * @param {Record<string, string>} errors - Mutable field-error collection.
 * @returns {void}
 * @sideEffects Adds personal-information validation messages to `errors`.
 */
function validatePersonalInformation(personal, errors) {
  const information = personal || {};

  if (!information.fullName || !information.fullName.trim()) {
    errors["personalInformation.fullName"] = "Full name is required.";
  }

  if (!information.dateOfBirth) {
    errors["personalInformation.dateOfBirth"] = "Date of birth is required.";
  }

  if (
    information.dateOfBirth &&
    new Date(information.dateOfBirth) > new Date()
  ) {
    errors["personalInformation.dateOfBirth"] = "Date of birth cannot be in the future.";
  }

  if (!information.gender) {
    errors["personalInformation.gender"] = "Gender is required.";
  }

  if (!information.address || !information.address.trim()) {
    errors["personalInformation.address"] = "Address is required.";
  }

  if (!information.district || !information.district.trim()) {
    errors["personalInformation.district"] = "District is required.";
  }

  if (!information.division || !information.division.trim()) {
    errors["personalInformation.division"] = "Division is required.";
  }

  if (!information.familyRelationship || !information.familyRelationship.trim()) {
    errors["personalInformation.familyRelationship"] = "Your relationship is required.";
  }

  if (
    information.phone &&
    !PHONE_PATTERN.test(information.phone)
  ) {
    errors["personalInformation.phone"] = "Enter a valid phone number.";
  }
}

/**
 * Ensures embedded profile sections are bounded arrays before controllers assign them.
 * @param {Record<string, unknown>} body - Elderly profile request body.
 * @param {Record<string, string>} errors - Mutable field-error collection.
 * @returns {void}
 * @sideEffects Adds section-shape or section-size validation messages to `errors`.
 */
function validateSectionShapes(body, errors) {
  for (const section of PROFILE_SECTION_NAMES) {
    const sectionValue = body[section];

    // Omitted sections are valid for focused section updates.
    if (sectionValue === undefined) {
      continue;
    }

    if (!Array.isArray(sectionValue)) {
      errors[section] = "This section must be a list.";
      continue;
    }

    if (sectionValue.length > MAX_SECTION_ITEMS) {
      errors[section] = `This section cannot contain more than ${MAX_SECTION_ITEMS} entries.`;
    }
  }
}

/**
 * Validates primary-contact count, unique phone numbers, and required contact fields.
 * @param {object[]} contacts - Emergency-contact entries from the request.
 * @param {Record<string, string>} errors - Mutable field-error collection.
 * @returns {void}
 * @sideEffects Adds emergency-contact validation messages to `errors`.
 */
function validateEmergencyContacts(contacts, errors) {
  let primaryContactCount = 0;

  for (const contact of contacts) {
    if (contact.isPrimary) {
      primaryContactCount += 1;
    }
  }

  if (primaryContactCount > 1) {
    errors.emergencyContacts = "Only one emergency contact can be primary.";
  }

  // Formatting characters are removed so visually different versions of one number match.
  const normalizedPhones = [];

  for (const contact of contacts) {
    if (contact.phone) {
      const phone = contact.phone.replace(/\D/g, "");

      if (phone) {
        normalizedPhones.push(phone);
      }
    }
  }

  // Set keeps only one copy of each normalized phone number.
  const uniquePhones = new Set(normalizedPhones);

  if (uniquePhones.size !== normalizedPhones.length) {
    errors.emergencyContacts = "Emergency contact phone numbers must be unique.";
  }

  for (let index = 0; index < contacts.length; index += 1) {
    const contact = contacts[index];

    if (!contact.name || !contact.name.trim()) {
      errors[`emergencyContacts.${index}.name`] = "Contact name is required.";
    }

    if (!contact.relationship || !contact.relationship.trim()) {
      errors[`emergencyContacts.${index}.relationship`] = "Relationship is required.";
    }

    if (
      !contact.phone ||
      !PHONE_PATTERN.test(contact.phone)
    ) {
      errors[`emergencyContacts.${index}.phone`] = "Enter a valid phone number.";
    }
  }
}

/**
 * Validates medication names and chronological start/end dates.
 * @param {object[]} medications - Medication entries from the request.
 * @param {Record<string, string>} errors - Mutable field-error collection.
 * @returns {void}
 * @sideEffects Adds medication validation messages to `errors`.
 */
function validateMedications(medications, errors) {
  for (let index = 0; index < medications.length; index += 1) {
    const medication = medications[index];

    if (!medication.name || !medication.name.trim()) {
      errors[`medications.${index}.name`] = "Medicine name is required.";
    }

    const hasDateRange = medication.startDate && medication.endDate;
    const startsAfterEnd =
      hasDateRange &&
      new Date(medication.startDate) > new Date(medication.endDate);

    if (startsAfterEnd) {
      errors[`medications.${index}.endDate`] =
        "End date cannot be before the start date.";
    }
  }
}

/**
 * Validates cross-field and array constraints not expressed safely by Mongoose alone.
 * @param {Record<string, unknown>} body - Elderly profile request body.
 * @param {{requirePersonalInformation?: boolean}} [options] - Validation mode.
 * @returns {void}
 * @sideEffects Throws a 422 ApiError containing field-level details.
 */
export function validateElderlyProfilePayload(
  body,
  {
    requirePersonalInformation = true,
  } = {},
) {
  const errors = {};
  const payload = body || {};

  if (requirePersonalInformation) {
    validatePersonalInformation(
      payload.personalInformation,
      errors,
    );
  }

  validateSectionShapes(payload, errors);
  validateEmergencyContacts(
    payload.emergencyContacts || [],
    errors,
  );
  validateMedications(
    payload.medications || [],
    errors,
  );

  if (Object.keys(errors).length > 0) {
    throw new ApiError(
      422,
      "Please correct the elderly profile information.",
      errors,
    );
  }
}
