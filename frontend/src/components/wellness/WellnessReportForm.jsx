import { useEffect, useState } from "react";
import { Button } from "../Button.jsx";
import { Input } from "../Input.jsx";
import {
  ActivityIcon,
  BloodIcon,
  ClockIcon,
  HeartPulseIcon,
  PillIcon,
  SaveIcon,
  SendIcon,
  UtensilsIcon,
} from "../Icons.jsx";

const MOODS = ["excellent", "good", "okay", "low", "distressed"];
const MEAL_STATUSES = ["full", "partial", "missed", "not-applicable"];
const MEDICINE_STATUSES = [
  "all-taken",
  "partially-taken",
  "missed",
  "not-scheduled",
  "unknown",
];
const BLOOD_SUGAR_CONTEXTS = ["fasting", "before-meal", "after-meal", "random", "unknown"];

/**
 * Formats a stored date for a native date or datetime-local input in local time.
 * @param {string|Date|null} value - Stored ISO value.
 * @param {boolean} [includeTime=false] - Whether to include local hours and minutes.
 * @returns {string} Native-input value or an empty string.
 * @sideEffects None.
 */
function toLocalInputValue(value, includeTime = false) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  let endPosition = 10;

  if (includeTime) {
    endPosition = 16;
  }

  // slice keeps only the part understood by native date and datetime-local inputs.
  return offsetDate.toISOString().slice(0, endPosition);
}

/**
 * Produces a complete form-safe report value from an optional API report.
 * @param {object|null} report - Existing report draft when editing.
 * @returns {Record<string, unknown>} Controlled form value with scalar vitals inputs.
 * @sideEffects Reads the current date when creating a new value.
 */
function toFormValue(report) {
  const source = report || {};
  const sourceVitals = source.vitals || {};
  let visitDate = source.visitDate;

  if (!visitDate) {
    visitDate = new Date();
  }

  return {
    careAssignmentId: source.careAssignmentId || "",
    elderlyProfileId: source.elderlyProfileId || "",
    visitDate: toLocalInputValue(visitDate),
    checkInAt: toLocalInputValue(source.checkInAt, true),
    checkOutAt: toLocalInputValue(source.checkOutAt, true),
    mood: source.mood || "",
    mealStatus: source.mealStatus || "",
    mealNotes: source.mealNotes || "",
    medicineIntakeStatus: source.medicineIntakeStatus || "",
    medicineNotes: source.medicineNotes || "",
    vitals: {
      systolic: sourceVitals.systolic ?? "",
      diastolic: sourceVitals.diastolic ?? "",
      bloodSugar: sourceVitals.bloodSugar ?? "",
      bloodSugarContext: sourceVitals.bloodSugarContext || "",
      weightKg: sourceVitals.weightKg ?? "",
      measuredAt: toLocalInputValue(sourceVitals.measuredAt, true),
    },
    exerciseDurationMinutes: source.exerciseDurationMinutes ?? "",
    observations: source.observations || "",
    caregiverNotes: source.caregiverNotes || "",
    nextVisitDate: toLocalInputValue(source.nextVisitDate, true),
  };
}

/**
 * Converts enum-style values into readable select option labels.
 * @param {string} value - Hyphenated enum value.
 * @returns {string} Capitalized label.
 * @sideEffects None.
 */
function humanize(value) {
  const text = value.replaceAll("-", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Renders a labeled native select with shared validation presentation.
 * @param {{id: string, label: string, value: string, options: string[], error?: string, placeholder: string, onChange: Function}} props - Select configuration.
 * @returns {import("react").ReactElement} Accessible select field.
 * @sideEffects Invokes the supplied change handler.
 */
function SelectField({ id, label, value, options, error, placeholder, onChange }) {
  const inputClassName = error ? "input input--error" : "input";

  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <select
        id={id}
        className={inputClassName}
        value={value}
        onChange={onChange}
        aria-invalid={Boolean(error)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option value={option} key={option}>
            {humanize(option)}
          </option>
        ))}
      </select>
      {error && (
        <small className="field__error">
          {error}
        </small>
      )}
    </label>
  );
}

/**
 * Renders the structured caregiver wellness-report editor.
 * @param {{report?: object|null, assignments: object[], errors?: object, isBusy?: boolean, onSaveDraft: Function, onRequestSubmit: Function}} props - Existing report, available assignments, feedback, and persistence actions.
 * @returns {import("react").ReactElement} Multi-section controlled report form.
 * @sideEffects Manages local form state and invokes draft or submission callbacks.
 */
export function WellnessReportForm({
  report = null,
  assignments,
  errors = {},
  isBusy = false,
  onSaveDraft,
  onRequestSubmit,
}) {
  const [value, setValue] = useState(() => toFormValue(report));

  useEffect(() => {
    setValue(toFormValue(report));
  }, [report]);

  useEffect(() => {
    if (report || !assignments.length) {
      return;
    }

    setValue((current) => {
      if (current.careAssignmentId) {
        return current;
      }

      const assignment = assignments[0];

      return {
        ...current,
        careAssignmentId: assignment.id,
        elderlyProfileId: assignment.elderlyProfileId,
        visitDate: toLocalInputValue(assignment.startsAt || new Date()),
      };
    });
  }, [assignments, report]);

  /**
   * Updates one top-level controlled report field.
   * @param {import("react").ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>} event - Changed form event.
   * @returns {void}
   * @sideEffects Updates local report form state.
   */
  function handleChange(event) {
    const fieldName = event.target.name;
    const fieldValue = event.target.value;

    setValue((current) => {
      return {
        ...current,
        [fieldName]: fieldValue,
      };
    });
  }

  /**
   * Updates one nested vitals field.
   * @param {string} field - Vitals property name.
   * @param {string} nextValue - New controlled input value.
   * @returns {void}
   * @sideEffects Updates local report form state.
   */
  function handleVitalChange(field, nextValue) {
    setValue((current) => ({
      ...current,
      vitals: { ...current.vitals, [field]: nextValue },
    }));
  }

  /**
   * Selects an assignment and synchronizes its elderly profile into the payload.
   * @param {import("react").ChangeEvent<HTMLSelectElement>} event - Assignment selection event.
   * @returns {void}
   * @sideEffects Updates assignment, elderly profile, and suggested visit date form state.
   */
  function handleAssignmentChange(event) {
    const selectedAssignmentId = event.target.value;

    // find returns the first assignment whose id matches the selected option.
    const assignment = assignments.find((item) => {
      return item.id === selectedAssignmentId;
    });

    setValue((current) => {
      let elderlyProfileId = "";
      let visitDate = current.visitDate;

      if (assignment) {
        elderlyProfileId = assignment.elderlyProfileId;
        visitDate = toLocalInputValue(assignment.startsAt);
      }

      return {
        ...current,
        careAssignmentId: selectedAssignmentId,
        elderlyProfileId,
        visitDate,
      };
    });
  }

  /**
   * Saves the currently displayed fields as a draft.
   * @returns {void}
   * @sideEffects Invokes the parent draft-saving callback.
   */
  function handleSaveDraft() {
    onSaveDraft(value);
  }

  /**
   * Prevents native navigation and forwards the current value for final confirmation.
   * @param {import("react").FormEvent<HTMLFormElement>} event - Form submission event.
   * @returns {void}
   * @sideEffects Invokes the parent submission-confirmation callback.
   */
  function handleSubmit(event) {
    event.preventDefault();
    onRequestSubmit(value);
  }

  return (
    <form className="wellness-form" onSubmit={handleSubmit}>
      <section className="wellness-form-section">
        <div className="wellness-form-section__heading"><span><ClockIcon /></span><div><h2>Visit details</h2><p>Connect this report to an assigned visit and record arrival information.</p></div></div>
        <div className="form-grid">
          <label className="field field--wide" htmlFor="report-assignment"><span>Assigned care visit</span><select id="report-assignment" className={errors.careAssignmentId ? "input input--error" : "input"} value={value.careAssignmentId} onChange={handleAssignmentChange} disabled={Boolean(report)}><option value="">Choose an assigned visit</option>{assignments.map((assignment) => <option value={assignment.id} key={assignment.id}>{assignment.elderly.preferredName || assignment.elderly.fullName} · {humanize(assignment.assignmentType)} · {new Date(assignment.startsAt).toLocaleDateString("en-GB")}</option>)}</select>{errors.careAssignmentId && <small className="field__error">{errors.careAssignmentId}</small>}</label>
          <Input id="report-visit-date" name="visitDate" type="date" label="Visit date" value={value.visitDate} onChange={handleChange} error={errors.visitDate} required />
          <Input id="report-check-in" name="checkInAt" type="datetime-local" label="Check-in time" value={value.checkInAt} onChange={handleChange} error={errors.checkInAt} />
          <Input id="report-check-out" name="checkOutAt" type="datetime-local" label="Check-out time" value={value.checkOutAt} onChange={handleChange} error={errors.checkOutAt} />
          <Input id="report-next-visit" name="nextVisitDate" type="datetime-local" label="Next visit (optional)" value={value.nextVisitDate} onChange={handleChange} error={errors.nextVisitDate} />
        </div>
      </section>

      <section className="wellness-form-section">
        <div className="wellness-form-section__heading"><span><ActivityIcon /></span><div><h2>Daily wellness</h2><p>Record mood, meals, movement, and a concise health observation.</p></div></div>
        <div className="form-grid">
          <SelectField id="report-mood" label="Mood" value={value.mood} options={MOODS} placeholder="Choose mood" error={errors.mood} onChange={(event) => setValue((current) => ({ ...current, mood: event.target.value }))} />
          <SelectField id="report-meal-status" label="Meal status" value={value.mealStatus} options={MEAL_STATUSES} placeholder="Choose meal status" error={errors.mealStatus} onChange={(event) => setValue((current) => ({ ...current, mealStatus: event.target.value }))} />
          <Input id="report-exercise" name="exerciseDurationMinutes" type="number" min="0" max="600" label="Exercise duration (minutes)" value={value.exerciseDurationMinutes} onChange={handleChange} error={errors.exerciseDurationMinutes} />
          <label className="field field--wide" htmlFor="report-meal-notes"><span><UtensilsIcon size={16} /> Meal notes</span><textarea id="report-meal-notes" name="mealNotes" className={errors.mealNotes ? "input textarea input--error" : "input textarea"} value={value.mealNotes} onChange={handleChange} placeholder="What was offered and how much was eaten?" />{errors.mealNotes && <small className="field__error">{errors.mealNotes}</small>}</label>
          <label className="field field--wide" htmlFor="report-observations"><span>Health observations</span><textarea id="report-observations" name="observations" className={errors.observations ? "input textarea input--error" : "input textarea"} value={value.observations} onChange={handleChange} placeholder="Describe alertness, comfort, mobility, pain, or changes noticed today." />{errors.observations && <small className="field__error">{errors.observations}</small>}</label>
        </div>
      </section>

      <section className="wellness-form-section">
        <div className="wellness-form-section__heading"><span><PillIcon /></span><div><h2>Medicine summary</h2><p>Confirm the visit-level outcome. Individual schedules and refills remain in Medicine Management.</p></div></div>
        <div className="form-grid">
          <SelectField id="report-medicine" label="Medicine intake" value={value.medicineIntakeStatus} options={MEDICINE_STATUSES} placeholder="Choose medicine status" error={errors.medicineIntakeStatus} onChange={(event) => setValue((current) => ({ ...current, medicineIntakeStatus: event.target.value }))} />
          <label className="field field--wide" htmlFor="report-medicine-notes"><span>Medicine notes</span><textarea id="report-medicine-notes" name="medicineNotes" className={errors.medicineNotes ? "input textarea input--error" : "input textarea"} value={value.medicineNotes} onChange={handleChange} placeholder="Mention a refusal, missed dose, or other relevant context." />{errors.medicineNotes && <small className="field__error">{errors.medicineNotes}</small>}</label>
        </div>
      </section>

      <section className="wellness-form-section">
        <div className="wellness-form-section__heading"><span><HeartPulseIcon /></span><div><h2>Vitals</h2><p>Record only measurements taken during this visit. Values are displayed without automated diagnosis.</p></div></div>
        <div className="form-grid wellness-vitals-grid">
          <Input id="report-systolic" type="number" min="50" max="260" label="Systolic (mmHg)" value={value.vitals.systolic} onChange={(event) => handleVitalChange("systolic", event.target.value)} error={errors["vitals.systolic"]} />
          <Input id="report-diastolic" type="number" min="30" max="180" label="Diastolic (mmHg)" value={value.vitals.diastolic} onChange={(event) => handleVitalChange("diastolic", event.target.value)} error={errors["vitals.diastolic"]} />
          <Input id="report-blood-sugar" type="number" min="20" max="600" step="0.1" label="Blood sugar (mg/dL)" value={value.vitals.bloodSugar} onChange={(event) => handleVitalChange("bloodSugar", event.target.value)} error={errors["vitals.bloodSugar"]} />
          <SelectField id="report-sugar-context" label="Blood sugar context" value={value.vitals.bloodSugarContext} options={BLOOD_SUGAR_CONTEXTS} placeholder="Choose measurement context" error={errors["vitals.bloodSugarContext"]} onChange={(event) => handleVitalChange("bloodSugarContext", event.target.value)} />
          <Input id="report-weight" type="number" min="20" max="300" step="0.1" label="Weight (kg)" value={value.vitals.weightKg} onChange={(event) => handleVitalChange("weightKg", event.target.value)} error={errors["vitals.weightKg"]} />
          <Input id="report-measured-at" type="datetime-local" label="Vitals measured at" value={value.vitals.measuredAt} onChange={(event) => handleVitalChange("measuredAt", event.target.value)} error={errors["vitals.measuredAt"]} />
        </div>
      </section>

      <section className="wellness-form-section">
        <div className="wellness-form-section__heading"><span><BloodIcon /></span><div><h2>Caregiver handoff</h2><p>Add useful context for the family or the next care visit.</p></div></div>
        <label className="field" htmlFor="report-caregiver-notes"><span>Additional caregiver notes</span><textarea id="report-caregiver-notes" name="caregiverNotes" className={errors.caregiverNotes ? "input textarea input--error" : "input textarea"} value={value.caregiverNotes} onChange={handleChange} placeholder="Optional instructions, follow-up items, or context." />{errors.caregiverNotes && <small className="field__error">{errors.caregiverNotes}</small>}</label>
      </section>

      {errors.form && <div className="alert alert--error">{errors.form}</div>}
      <div className="wellness-form-actions">
        <Button
          type="button"
          variant="secondary"
          isLoading={isBusy}
          onClick={handleSaveDraft}
        >
          <SaveIcon size={18} />
          Save draft
        </Button>
        <Button type="submit" isLoading={isBusy}>
          <SendIcon size={18} />
          Review and submit
        </Button>
      </div>
    </form>
  );
}
