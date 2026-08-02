import { useEffect, useMemo, useState } from "react";
import { Button } from "../Button.jsx";
import { Input } from "../Input.jsx";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CloseIcon,
  PlusIcon,
  SaveIcon,
} from "../Icons.jsx";

const STEPS = [
  { key: "personalInformation", label: "Personal" },
  { key: "medicalHistory", label: "History" },
  { key: "health", label: "Health details" },
  { key: "medications", label: "Medications" },
  { key: "emergencyContacts", label: "Emergency" },
  { key: "review", label: "Review" },
];

const EMPTY_PROFILE = {
  personalInformation: {
    fullName: "",
    preferredName: "",
    dateOfBirth: "",
    gender: "",
    bloodGroup: "unknown",
    phone: "",
    address: "",
    district: "",
    division: "",
    preferredLanguage: "Bangla",
    familyRelationship: "",
    careNotes: "",
  },
  medicalHistory: [],
  allergies: [],
  medications: [],
  chronicDiseases: [],
  emergencyContacts: [],
};

const SECTION_FIELDS = {
  medicalHistory: [
    ["condition", "Condition or event", "text", true],
    ["diagnosisDate", "Diagnosis date", "date"],
    ["treatmentSummary", "Treatment summary"],
    ["hospitalOrDoctor", "Hospital or doctor"],
    ["status", "Status", "select", false, ["active", "recovered", "managed", "unknown"]],
    ["notes", "Notes"],
  ],
  allergies: [
    ["allergen", "Allergen", "text", true],
    ["type", "Type", "select", false, ["medicine", "food", "environmental", "other"]],
    ["reaction", "Reaction"],
    ["severity", "Severity", "select", false, ["mild", "moderate", "severe", "unknown"]],
    ["notes", "Notes"],
  ],
  chronicDiseases: [
    ["name", "Disease name", "text", true],
    ["diagnosisDate", "Diagnosis date", "date"],
    ["managingDoctor", "Managing doctor"],
    ["status", "Status", "select", false, ["active", "recovered", "managed", "unknown"]],
    ["notes", "Notes"],
  ],
  medications: [
    ["name", "Medicine name", "text", true],
    ["strength", "Strength"],
    ["dosage", "Dosage"],
    ["form", "Form"],
    ["reason", "Reason"],
    ["prescribingDoctor", "Prescribing doctor"],
    ["startDate", "Start date", "date"],
    ["endDate", "End date", "date"],
    ["notes", "Notes"],
  ],
  emergencyContacts: [
    ["name", "Contact name", "text", true],
    ["relationship", "Relationship", "text", true],
    ["phone", "Phone", "tel", true],
    ["alternativePhone", "Alternative phone", "tel"],
    ["address", "Address"],
    ["priority", "Priority", "number"],
  ],
};

/**
 * Creates a clean form value from an API profile or the empty template.
 * @param {Record<string, unknown>|null} profile - Existing profile for edit mode.
 * @returns {Record<string, unknown>} Form-safe profile without Mongoose metadata.
 * @sideEffects None.
 */
function createInitialValue(profile) {
  if (!profile) return structuredClone(EMPTY_PROFILE);
  const cleanDate = (value) => (value ? String(value).slice(0, 10) : "");
  return {
    personalInformation: {
      ...EMPTY_PROFILE.personalInformation,
      ...profile.personalInformation,
      dateOfBirth: cleanDate(profile.personalInformation?.dateOfBirth),
    },
    ...Object.fromEntries(
      ["medicalHistory", "allergies", "medications", "chronicDiseases", "emergencyContacts"].map(
        (section) => [
          section,
          (profile[section] || []).map((item) => ({
            ...item,
            diagnosisDate: cleanDate(item.diagnosisDate),
            startDate: cleanDate(item.startDate),
            endDate: cleanDate(item.endDate),
          })),
        ],
      ),
    ),
  };
}

/**
 * Returns a blank repeated-section item with sensible enum defaults.
 * @param {string} section - Medical/contact section name.
 * @returns {Record<string, unknown>} New editable item.
 * @sideEffects None.
 */
function createSectionItem(section) {
  if (section === "medicalHistory") return { condition: "", status: "unknown" };
  if (section === "allergies") return { allergen: "", type: "other", severity: "unknown" };
  if (section === "chronicDiseases") return { name: "", status: "active" };
  if (section === "medications") return { name: "", isActive: true };
  return { name: "", relationship: "", phone: "", priority: 1, isPrimary: false };
}

/**
 * Renders a list editor for one repeatable profile section.
 * @param {{section: string, title: string, description: string, items: object[], errors: object, onChange: Function}} props - Section state and change action.
 * @returns {import("react").ReactElement} Repeated entry cards and add action.
 * @sideEffects Calls `onChange` when entries are added, edited, or removed.
 */
function RepeatedSection({ section, title, description, items, errors, onChange }) {
  /**
   * Updates one property on one repeated entry.
   * @param {number} index - Entry position.
   * @param {string} key - Entry property.
   * @param {unknown} value - New property value.
   * @returns {void}
   * @sideEffects Calls the parent state setter.
   */
  function updateItem(index, key, value) {
    onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  }

  return (
    <section className="form-section">
      <div className="section-heading"><div><h2>{title}</h2><p>{description}</p></div><Button type="button" variant="secondary" onClick={() => onChange([...items, createSectionItem(section)])}><PlusIcon size={18} /> Add entry</Button></div>
      {!items.length && <div className="empty-state">No entries added. You can leave this section empty.</div>}
      <div className="repeat-list">
        {items.map((item, index) => (
          <article className="repeat-card" key={item._id || `${section}-${index}`}>
            <div className="repeat-card__header"><strong>{title} {index + 1}</strong><Button type="button" variant="ghost" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}><CloseIcon size={17} /> Remove</Button></div>
            <div className="form-grid">
              {SECTION_FIELDS[section].map(([key, label, type = "text", required = false, options]) => (
                <label className="field" key={key}>
                  <span>{label}</span>
                  {type === "select" ? (
                    <select className="input" value={item[key] || options[0]} onChange={(event) => updateItem(index, key, event.target.value)}>
                      {options.map((option) => <option value={option} key={option}>{option.replaceAll("-", " ")}</option>)}
                    </select>
                  ) : (
                    <input className={errors[`${section}.${index}.${key}`] ? "input input--error" : "input"} type={type} required={required} value={item[key] ?? ""} onChange={(event) => updateItem(index, key, type === "number" ? Number(event.target.value) : event.target.value)} />
                  )}
                  {errors[`${section}.${index}.${key}`] && <small className="field__error">{errors[`${section}.${index}.${key}`]}</small>}
                </label>
              ))}
              {section === "emergencyContacts" && (
                <label className="check-field"><input type="checkbox" checked={Boolean(item.isPrimary)} onChange={(event) => onChange(items.map((contact, itemIndex) => ({ ...contact, isPrimary: itemIndex === index ? event.target.checked : false })))} /> Primary emergency contact</label>
              )}
            </div>
          </article>
        ))}
      </div>
      {errors[section] && <div className="alert alert--error">{errors[section]}</div>}
    </section>
  );
}

/**
 * Renders the reusable create/edit elderly profile workflow.
 * @param {{initialProfile?: object|null, onSubmit: (value: object) => Promise<void>, isSubmitting?: boolean, errors?: object, submitLabel?: string}} props - Initial data and submission state.
 * @returns {import("react").ReactElement} Multi-step profile form.
 * @sideEffects Manages form state and calls `onSubmit` on final confirmation.
 */
export function ProfileForm({
  initialProfile = null,
  onSubmit,
  isSubmitting = false,
  errors = {},
  submitLabel = "Create profile",
}) {
  const [value, setValue] = useState(() => createInitialValue(initialProfile));
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];

  useEffect(() => setValue(createInitialValue(initialProfile)), [initialProfile]);
  const age = useMemo(() => {
    if (!value.personalInformation.dateOfBirth) return null;
    return Math.max(
      0,
      Math.floor((Date.now() - new Date(value.personalInformation.dateOfBirth)) / 31557600000),
    );
  }, [value.personalInformation.dateOfBirth]);

  /**
   * Updates one personal-information field.
   * @param {import("react").ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>} event - Changed form field.
   * @returns {void}
   * @sideEffects Updates local form state.
   */
  function updatePersonal(event) {
    const { name, value: fieldValue } = event.target;
    setValue((current) => ({
      ...current,
      personalInformation: { ...current.personalInformation, [name]: fieldValue },
    }));
  }

  /**
   * Advances after native required-field validation.
   * @param {import("react").FormEvent<HTMLFormElement>} event - Current step submission.
   * @returns {Promise<void>}
   * @sideEffects Changes steps or invokes the supplied final API submission.
   */
  async function handleStepSubmit(event) {
    event.preventDefault();
    if (step.key === "review") await onSubmit(value);
    else setStepIndex((current) => Math.min(current + 1, STEPS.length - 1));
  }

  return (
    <form className="profile-form" onSubmit={handleStepSubmit}>
      <ol className="stepper" aria-label="Profile steps">
        {STEPS.map((item, index) => <li className={index === stepIndex ? "stepper__active" : index < stepIndex ? "stepper__done" : ""} key={item.key}><button type="button" onClick={() => setStepIndex(index)}><span>{index + 1}</span>{item.label}</button></li>)}
      </ol>

      {step.key === "personalInformation" && (
        <section className="form-section">
          <div className="section-heading"><div><h2>Personal information</h2><p>Basic information used throughout their care record.</p></div></div>
          <div className="form-grid">
            <Input id="fullName" name="fullName" label="Full name" value={value.personalInformation.fullName} onChange={updatePersonal} error={errors["personalInformation.fullName"]} required />
            <Input id="preferredName" name="preferredName" label="Preferred name" value={value.personalInformation.preferredName} onChange={updatePersonal} />
            <Input id="dateOfBirth" name="dateOfBirth" type="date" label="Date of birth" max={new Date().toISOString().slice(0, 10)} value={value.personalInformation.dateOfBirth} onChange={updatePersonal} error={errors["personalInformation.dateOfBirth"]} required />
            <label className="field"><span>Gender</span><select className="input" name="gender" value={value.personalInformation.gender} onChange={updatePersonal} required><option value="">Select gender</option><option value="female">Female</option><option value="male">Male</option><option value="non-binary">Non-binary</option><option value="prefer-not-to-say">Prefer not to say</option></select></label>
            <label className="field"><span>Blood group</span><select className="input" name="bloodGroup" value={value.personalInformation.bloodGroup} onChange={updatePersonal}>{["unknown", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((group) => <option value={group} key={group}>{group}</option>)}</select></label>
            <Input id="phone" name="phone" type="tel" label="Phone number" value={value.personalInformation.phone} onChange={updatePersonal} error={errors["personalInformation.phone"]} />
            <Input id="familyRelationship" name="familyRelationship" label="Your relationship" placeholder="For example, daughter" value={value.personalInformation.familyRelationship} onChange={updatePersonal} error={errors["personalInformation.familyRelationship"]} required />
            <Input id="preferredLanguage" name="preferredLanguage" label="Preferred language" value={value.personalInformation.preferredLanguage} onChange={updatePersonal} />
            <Input id="address" name="address" label="Home address" value={value.personalInformation.address} onChange={updatePersonal} error={errors["personalInformation.address"]} required />
            <Input id="district" name="district" label="District" value={value.personalInformation.district} onChange={updatePersonal} error={errors["personalInformation.district"]} required />
            <Input id="division" name="division" label="Division" value={value.personalInformation.division} onChange={updatePersonal} error={errors["personalInformation.division"]} required />
            <label className="field field--wide"><span>General care notes</span><textarea className="input textarea" name="careNotes" value={value.personalInformation.careNotes} onChange={updatePersonal} /></label>
          </div>
        </section>
      )}
      {step.key === "medicalHistory" && <RepeatedSection section="medicalHistory" title="Medical history" description="Past diagnoses, procedures, and significant medical events." items={value.medicalHistory} errors={errors} onChange={(items) => setValue((current) => ({ ...current, medicalHistory: items }))} />}
      {step.key === "health" && <div className="stacked-sections"><RepeatedSection section="allergies" title="Allergies" description="Known medicine, food, and environmental allergies." items={value.allergies} errors={errors} onChange={(items) => setValue((current) => ({ ...current, allergies: items }))} /><RepeatedSection section="chronicDiseases" title="Chronic diseases" description="Long-term conditions requiring ongoing awareness." items={value.chronicDiseases} errors={errors} onChange={(items) => setValue((current) => ({ ...current, chronicDiseases: items }))} /></div>}
      {step.key === "medications" && <RepeatedSection section="medications" title="Current medications" description="Record current medicines only. Scheduling and reminders come later." items={value.medications} errors={errors} onChange={(items) => setValue((current) => ({ ...current, medications: items }))} />}
      {step.key === "emergencyContacts" && <RepeatedSection section="emergencyContacts" title="Emergency contacts" description="People who should be contacted in an urgent situation." items={value.emergencyContacts} errors={errors} onChange={(items) => setValue((current) => ({ ...current, emergencyContacts: items }))} />}
      {step.key === "review" && (
        <section className="form-section review-panel"><span className="profile-avatar">{value.personalInformation.preferredName?.[0] || value.personalInformation.fullName?.[0] || "P"}</span><div><span className="eyebrow">Ready to save</span><h2>{value.personalInformation.fullName || "Unnamed profile"}</h2><p>{age !== null ? `${age} years old` : "Age not available"} · {value.personalInformation.district || "District not provided"}</p></div><div className="review-stats"><span><strong>{value.medicalHistory.length}</strong> history entries</span><span><strong>{value.allergies.length}</strong> allergies</span><span><strong>{value.medications.length}</strong> medications</span><span><strong>{value.emergencyContacts.length}</strong> emergency contacts</span></div>{errors.form && <div className="alert alert--error">{errors.form}</div>}</section>
      )}
      <div className="form-actions">
        {stepIndex > 0 && <Button type="button" variant="secondary" onClick={() => setStepIndex((current) => current - 1)}><ArrowLeftIcon size={18} /> Back</Button>}
        <Button type="submit" isLoading={isSubmitting}>{step.key === "review" ? <><SaveIcon size={18} /> {submitLabel}</> : <>Continue <ArrowRightIcon size={18} /></>}</Button>
      </div>
    </form>
  );
}
