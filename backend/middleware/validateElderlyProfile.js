import { ApiError } from "../utils/ApiError.js";

const PHONE_PATTERN = /^[+\d][\d\s()-]{5,29}$/;
const MAX_SECTION_ITEMS = 50;

/**
 * Validates cross-field and array constraints not expressed safely by Mongoose alone.
 * @param {Record<string, unknown>} body - Elderly profile request body.
 * @param {{requirePersonalInformation?: boolean}} [options] - Validation mode.
 * @returns {void}
 * @sideEffects Throws a 422 ApiError containing field-level details.
 */
export function validateElderlyProfilePayload(
  body,
  { requirePersonalInformation = true } = {},
) {
  const errors = {};
  const personal = body?.personalInformation;

  if (requirePersonalInformation) {
    if (!personal?.fullName?.trim()) errors["personalInformation.fullName"] = "Full name is required.";
    if (!personal?.dateOfBirth) errors["personalInformation.dateOfBirth"] = "Date of birth is required.";
    if (personal?.dateOfBirth && new Date(personal.dateOfBirth) > new Date()) {
      errors["personalInformation.dateOfBirth"] = "Date of birth cannot be in the future.";
    }
    if (!personal?.gender) errors["personalInformation.gender"] = "Gender is required.";
    if (!personal?.address?.trim()) errors["personalInformation.address"] = "Address is required.";
    if (!personal?.district?.trim()) errors["personalInformation.district"] = "District is required.";
    if (!personal?.division?.trim()) errors["personalInformation.division"] = "Division is required.";
    if (!personal?.familyRelationship?.trim()) {
      errors["personalInformation.familyRelationship"] = "Your relationship is required.";
    }
    if (personal?.phone && !PHONE_PATTERN.test(personal.phone)) {
      errors["personalInformation.phone"] = "Enter a valid phone number.";
    }
  }

  ["medicalHistory", "allergies", "medications", "chronicDiseases", "emergencyContacts"].forEach(
    (section) => {
      if (body?.[section] !== undefined && !Array.isArray(body[section])) {
        errors[section] = "This section must be a list.";
      } else if (body?.[section]?.length > MAX_SECTION_ITEMS) {
        errors[section] = `This section cannot contain more than ${MAX_SECTION_ITEMS} entries.`;
      }
    },
  );

  const contacts = body?.emergencyContacts || [];
  if (contacts.filter((contact) => contact.isPrimary).length > 1) {
    errors.emergencyContacts = "Only one emergency contact can be primary.";
  }
  const contactPhones = contacts.map((contact) => contact.phone?.replace(/\D/g, "")).filter(Boolean);
  if (new Set(contactPhones).size !== contactPhones.length) {
    errors.emergencyContacts = "Emergency contact phone numbers must be unique.";
  }
  contacts.forEach((contact, index) => {
    if (!contact.name?.trim()) errors[`emergencyContacts.${index}.name`] = "Contact name is required.";
    if (!contact.relationship?.trim()) {
      errors[`emergencyContacts.${index}.relationship`] = "Relationship is required.";
    }
    if (!contact.phone || !PHONE_PATTERN.test(contact.phone)) {
      errors[`emergencyContacts.${index}.phone`] = "Enter a valid phone number.";
    }
  });

  (body?.medications || []).forEach((medication, index) => {
    if (!medication.name?.trim()) errors[`medications.${index}.name`] = "Medicine name is required.";
    if (
      medication.startDate &&
      medication.endDate &&
      new Date(medication.startDate) > new Date(medication.endDate)
    ) {
      errors[`medications.${index}.endDate`] = "End date cannot be before the start date.";
    }
  });

  if (Object.keys(errors).length) {
    throw new ApiError(422, "Please correct the elderly profile information.", errors);
  }
}
