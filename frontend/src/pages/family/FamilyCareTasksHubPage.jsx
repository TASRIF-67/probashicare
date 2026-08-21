import { ProfileFeatureHub } from "../../components/elderly/ProfileFeatureHub.jsx";
import { CareTasksIcon } from "../../components/Icons.jsx";

/**
 * Builds the canonical care-task route for one elderly profile.
 * @param {string} profileId - ElderlyProfile identifier.
 * @returns {string} Profile-specific care-task route.
 * @sideEffects None.
 */
function buildCareTaskDestination(profileId) {
  return "/care-tasks/" + profileId;
}

/**
 * Presents care-visit planning as a separate Family workspace destination.
 * @param {void} _unused - This page accepts no props.
 * @returns {import("react").ReactElement} Care-task profile-selection hub.
 * @sideEffects The shared hub loads active elderly profiles.
 */
export function FamilyCareTasksHubPage() {
  return (
    <ProfileFeatureHub
      eyebrow="Care coordination"
      title="Care visit tasks"
      description="Choose a care recipient, prepare a concise visit checklist, and review caregiver task progress without mixing workflows into the health profile."
      icon={CareTasksIcon}
      actionLabel="Open task planner"
      emptyDescription="Create an elderly profile before assigning visit instructions to an accepted caregiver."
      buildDestination={buildCareTaskDestination}
    />
  );
}
