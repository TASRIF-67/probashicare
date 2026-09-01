/**
 * Converts a User document into a frontend-safe authentication response.
 * @param {import("../models/User.js").User} user - Mongoose User document.
 * @param {boolean} [hasLinkedElderlyProfiles=false] - Onboarding completion.
 * @param {string|null} [caregiverApplicationStatus=null] - Caregiver status.
 * @returns {object} Public authentication and onboarding fields.
 * @sideEffects None.
 */
export function toPublicUser(
  user,
  hasLinkedElderlyProfiles = false,
  caregiverApplicationStatus = null,
) {
  // Dot notation reads one property from the Mongoose document. The response
  // deliberately omits password, googleId, tokens, and other private fields.
  const publicUser = {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified,
    hasLinkedElderlyProfiles,
    caregiverApplicationStatus,
  };

  return publicUser;
}
