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
  if (!personal?.fullName?.trim()) {
    errors["personalInformation.fullName"] = "Full name is required.";
  }

  if (!personal?.dateOfBirth) {
    errors["personalInformation.dateOfBirth"] = "Date of birth is required.";
  }

  if (
    personal?.dateOfBirth &&
    new Date(personal.dateOfBirth) > new Date()
  ) {
    errors["personalInformation.dateOfBirth"] = "Date of birth cannot be in the future.";
  }

  if (!personal?.gender) {
    errors["personalInformation.gender"] = "Gender is required.";
  }

  if (!personal?.address?.trim()) {
    errors["personalInformation.address"] = "Address is required.";
  }

  if (!personal?.district?.trim()) {
    errors["personalInformation.district"] = "District is required.";
  }

  if (!personal?.division?.trim()) {
    errors["personalInformation.division"] = "Division is required.";
  }

  if (!personal?.familyRelationship?.trim()) {
    errors["personalInformation.familyRelationship"] = "Your relationship is required.";
  }

  if (
    personal?.phone &&
    !PHONE_PATTERN.test(personal.phone)
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
    const sectionValue = body?.[section];

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
  const primaryContacts = contacts.filter((contact) => {
    return contact.isPrimary;
  });

  if (primaryContacts.length > 1) {
    errors.emergencyContacts = "Only one emergency contact can be primary.";
  }

  // Formatting characters are removed so visually different versions of one number match.
  const normalizedPhones = contacts
    .map((contact) => {
      return contact.phone?.replace(/\D/g, "");
    })
    .filter((phone) => {
      return Boolean(phone);
    });

  const uniquePhones = new Set(normalizedPhones);

  if (uniquePhones.size !== normalizedPhones.length) {
    errors.emergencyContacts = "Emergency contact phone numbers must be unique.";
  }

  contacts.forEach((contact, index) => {
    if (!contact.name?.trim()) {
      errors[`emergencyContacts.${index}.name`] = "Contact name is required.";
    }

    if (!contact.relationship?.trim()) {
      errors[`emergencyContacts.${index}.relationship`] = "Relationship is required.";
    }

    if (
      !contact.phone ||
      !PHONE_PATTERN.test(contact.phone)
    ) {
      errors[`emergencyContacts.${index}.phone`] = "Enter a valid phone number.";
    }
  });
}

/**
 * Validates medication names and chronological start/end dates.
 * @param {object[]} medications - Medication entries from the request.
 * @param {Record<string, string>} errors - Mutable field-error collection.
 * @returns {void}
 * @sideEffects Adds medication validation messages to `errors`.
 */
function validateMedications(medications, errors) {
  medications.forEach((medication, index) => {
    if (!medication.name?.trim()) {
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
  });
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

  if (requirePersonalInformation) {
    validatePersonalInformation(
      body?.personalInformation,
      errors,
    );
  }

  validateSectionShapes(body, errors);
  validateEmergencyContacts(
    body?.emergencyContacts || [],
    errors,
  );
  validateMedications(
    body?.medications || [],
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
