/**
 * Converts a User document into the public authentication response.
 * @param {import("../models/User.js").User} user - Mongoose user document.
 * @param {boolean} [hasLinkedElderlyProfiles=false] - Whether family onboarding is complete.
 * @param {string|null} [caregiverApplicationStatus=null] - Caregiver gate status when applicable.
 * @returns {{id: string, name: string, email: string, role: string, isVerified: boolean, hasLinkedElderlyProfiles: boolean, caregiverApplicationStatus: string|null}} Public user fields.
 * @sideEffects None.
 */
export function toPublicUser(
  user,
  hasLinkedElderlyProfiles = false,
  caregiverApplicationStatus = null,
) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified,
    hasLinkedElderlyProfiles,
    caregiverApplicationStatus,
  };
}
