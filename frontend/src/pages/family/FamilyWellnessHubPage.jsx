import { ProfileFeatureHub } from "../../components/elderly/ProfileFeatureHub.jsx";
import { HeartPulseIcon } from "../../components/Icons.jsx";

/**
 * Builds the canonical wellness route for one elderly profile.
 * @param {string} profileId - ElderlyProfile identifier.
 * @returns {string} Profile-specific wellness route.
 * @sideEffects None.
 */
function buildWellnessDestination(profileId) {
  return "/wellness/" + profileId;
}

/**
 * Presents Wellness and vitals as a first-class Family workspace destination.
 * @param {void} _unused - This page accepts no props.
 * @returns {import("react").ReactElement} Wellness profile-selection hub.
 * @sideEffects The shared hub loads active elderly profiles.
 */
export function FamilyWellnessHubPage() {
  return (
    <ProfileFeatureHub
      eyebrow="Remote health monitoring"
      title="Wellness and vitals"
      description="Review submitted caregiver reports, early wellness alerts, AI-assisted summaries, and recorded vital trends from one dedicated workspace."
      icon={HeartPulseIcon}
      actionLabel="Open wellness record"
      emptyDescription="Create an elderly profile before collecting caregiver wellness reports and vital measurements."
      buildDestination={buildWellnessDestination}
    />
  );
}
