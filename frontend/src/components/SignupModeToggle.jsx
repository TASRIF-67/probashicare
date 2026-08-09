import { BriefcaseIcon, UsersIcon } from "./Icons.jsx";

/**
 * Switches the signup surface between Family and Caregiver without navigation.
 * @param {{value: "family"|"caregiver", onChange: (mode: "family"|"caregiver") => void}} props - Active mode and selection callback.
 * @returns {import("react").ReactElement} Neutral segmented signup-mode control.
 * @sideEffects Calls `onChange` when a segment is selected.
 */
export function SignupModeToggle({ value, onChange }) {
  return (
    <div className="signup-mode-toggle" role="group" aria-label="Choose account type">
      <button
        type="button"
        className={value === "family" ? "signup-mode-toggle__option signup-mode-toggle__option--active" : "signup-mode-toggle__option"}
        aria-pressed={value === "family"}
        onClick={() => onChange("family")}
      >
        <UsersIcon size={15} /> Family
      </button>
      <button
        type="button"
        className={value === "caregiver" ? "signup-mode-toggle__option signup-mode-toggle__option--active" : "signup-mode-toggle__option"}
        aria-pressed={value === "caregiver"}
        onClick={() => onChange("caregiver")}
      >
        <BriefcaseIcon size={15} /> Caregiver
      </button>
    </div>
  );
}
