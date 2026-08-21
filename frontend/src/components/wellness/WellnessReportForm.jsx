import { useEffect, useRef, useState } from "react";
import { Button } from "../Button.jsx";
import { Input } from "../Input.jsx";
import {
  ActivityIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  BloodIcon,
  CalendarIcon,
  ClockIcon,
  SaveIcon,
  SendIcon,
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
const REPORT_STEPS = [
  "Visit",
  "Daily care",
  "Review",
];

/**
 * Displays the report visit date with a visible button for the native calendar.
 * @param {{value: string, error?: string, disabled?: boolean, onChange: Function}} props - Controlled date value and form behavior.
 * @returns {import("react").ReactElement} Accessible native visit-date field.
 * @sideEffects Opens the browser date picker or focuses the date input.
 */
function ReportDateField({
  value,
  error,
  disabled = false,
  onChange,
}) {
  const inputReference = useRef(null);
  const inputClassName = error
    ? "input booking-date-input input--error"
    : "input booking-date-input";

  /**
   * Opens the browser calendar when supported and otherwise focuses the input.
   * @returns {void}
   * @sideEffects Opens native browser UI or moves keyboard focus.
   */
  function openCalendar() {
    const input = inputReference.current;

    if (!input || disabled) {
      return;
    }

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.focus();
  }

  return (
    <label className="field" htmlFor="report-visit-date">
      <span>Visit date</span>
      <span className="booking-date-field">
        <input
          ref={inputReference}
          id="report-visit-date"
          className={inputClassName}
          name="visitDate"
          type="date"
          value={value}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          onChange={onChange}
          required
        />
        <button
          className="booking-calendar-button"
          type="button"
          aria-label="Open calendar for visit date"
          disabled={disabled}
          onClick={openCalendar}
        >
          <CalendarIcon size={19} />
        </button>
      </span>
      {error && (
        <small className="field__error">
          {error}
        </small>
      )}
    </label>
  );
}

/**
 * Displays a report date-and-time input with a visible native picker button.
 * @param {{id: string, name: string, label: string, value: string, error?: string, disabled?: boolean, onChange: Function}} props - Controlled date-time field configuration.
 * @returns {import("react").ReactElement} Accessible native date-and-time field.
 * @sideEffects Opens the browser date-and-time picker or focuses the input.
 */
function ReportDateTimeField({
  id,
  name,
  label,
  value,
  error,
  disabled = false,
  onChange,
}) {
  const inputReference = useRef(null);
  const inputClassName = error
    ? "input booking-date-input input--error"
    : "input booking-date-input";

  /**
   * Opens the browser date-and-time picker when supported.
   * @returns {void}
   * @sideEffects Opens native browser UI or moves keyboard focus.
   */
  function openDateTimePicker() {
    const input = inputReference.current;

    if (!input || disabled) {
      return;
    }

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.focus();
  }

  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <span className="booking-date-field">
        <input
          ref={inputReference}
          id={id}
          className={inputClassName}
          name={name}
          type="datetime-local"
          value={value}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          onChange={onChange}
        />
        <button
          className="booking-calendar-button"
          type="button"
          aria-label={"Open date and time picker for " + label}
          disabled={disabled}
          onClick={openDateTimePicker}
        >
          <ClockIcon size={19} />
        </button>
      </span>
      {error && (
        <small className="field__error">
          {error}
        </small>
      )}
    </label>
  );
}

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
 * Returns the visual class for one report-progress step.
 * @param {number} stepIndex - Step being rendered.
 * @param {number} currentStep - Currently open step.
 * @returns {string} Step button class name.
 * @sideEffects None.
 */
function getStepClassName(stepIndex, currentStep) {
  if (stepIndex === currentStep) {
    return "wellness-step wellness-step--active";
  }

  if (stepIndex < currentStep) {
    return "wellness-step wellness-step--complete";
  }

  return "wellness-step";
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
 * Renders a short group of visible one-tap choices.
 * @param {{label: string, value: string, options: string[], error?: string, onChange: (value: string) => void}} props - Choice configuration and handler.
 * @returns {import("react").ReactElement} Accessible choice-button field.
 * @sideEffects Invokes the supplied change handler when a choice is pressed.
 */
function ChoiceField({ label, value, options, error, onChange }) {
  return (
    <fieldset className="wellness-choice-field">
      <legend>{label}</legend>
      <div className="wellness-choice-list">
        {options.map((option) => (
          <button
            type="button"
            className={value === option ? "is-selected" : ""}
            aria-pressed={value === option}
            key={option}
            onClick={() => {
              onChange(option);
            }}
          >
            {humanize(option)}
          </button>
        ))}
      </div>
      {error && <small className="field__error">{error}</small>}
    </fieldset>
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
  const [currentStep, setCurrentStep] = useState(0);
  const [stepError, setStepError] = useState("");

  useEffect(() => {
    setValue(toFormValue(report));
  }, [report]);

  useEffect(() => {
    const errorFields = Object.keys(errors);

    if (!errorFields.length) {
      return;
    }

    const visitFields = ["careAssignmentId", "elderlyProfileId", "visitDate", "checkInAt", "checkOutAt", "nextVisitDate"];
    const dailyCareFields = [
      "mood",
      "mealStatus",
      "mealNotes",
      "exerciseDurationMinutes",
      "observations",
      "medicineIntakeStatus",
      "medicineNotes",
    ];
    let errorStep = 2;

    for (const field of errorFields) {
      if (visitFields.includes(field)) {
        errorStep = 0;
        break;
      }

      if (dailyCareFields.includes(field) || field.startsWith("vitals.")) {
        errorStep = 1;
        break;
      }
    }

    setCurrentStep(errorStep);
  }, [errors]);

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

      if (assignment) {
        elderlyProfileId = assignment.elderlyProfileId;
      }

      return {
        ...current,
        careAssignmentId: selectedAssignmentId,
        elderlyProfileId,
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

  /**
   * Checks the required information for the currently visible report step.
   * @returns {string} Readable problem or an empty string when the step is ready.
   * @sideEffects None.
   */
  function validateCurrentStep() {
    if (currentStep === 0) {
      if (!value.careAssignmentId || !value.visitDate || !value.checkInAt) {
        return "Choose an assigned visit and add the visit date and check-in time.";
      }

      if (value.checkOutAt && new Date(value.checkOutAt) <= new Date(value.checkInAt)) {
        return "Check-out time must be after check-in time.";
      }
    }

    if (currentStep === 1) {
      if (
        !value.mood
        || !value.mealStatus
        || !value.medicineIntakeStatus
        || !value.observations.trim()
      ) {
        return "Choose mood, meals, and medicine status, then add a brief observation.";
      }

      const hasSystolic = value.vitals.systolic !== "";
      const hasDiastolic = value.vitals.diastolic !== "";
      const hasBloodSugar = value.vitals.bloodSugar !== "";
      const hasWeight = value.vitals.weightKg !== "";
      const hasAnyVitals = hasSystolic || hasBloodSugar || hasWeight;

      if (hasSystolic !== hasDiastolic) {
        return "Record both systolic and diastolic blood pressure values together.";
      }

      if (hasAnyVitals && !value.vitals.measuredAt) {
        return "Add the time when the vital measurements were taken.";
      }

      if (hasBloodSugar && !value.vitals.bloodSugarContext) {
        return "Choose when the blood sugar measurement was taken.";
      }
    }

    return "";
  }

  /**
   * Opens the next report step after checking the current information.
   * @returns {void}
   * @sideEffects Updates step navigation or displays a step error.
   */
  function openNextStep() {
    const validationMessage = validateCurrentStep();

    if (validationMessage) {
      setStepError(validationMessage);
      return;
    }

    setStepError("");
    setCurrentStep((current) => Math.min(current + 1, REPORT_STEPS.length - 1));
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  /**
   * Returns to the previous report step.
   * @returns {void}
   * @sideEffects Updates step state and clears local step feedback.
   */
  function openPreviousStep() {
    setStepError("");
    setCurrentStep((current) => Math.max(current - 1, 0));
  }

  return (
    <form className="wellness-form" onSubmit={handleSubmit}>
      <nav className="wellness-stepper" aria-label="Wellness report progress">
        {REPORT_STEPS.map((step, index) => (
          <button
            type="button"
            className={getStepClassName(index, currentStep)}
            aria-current={index === currentStep ? "step" : undefined}
            disabled={index > currentStep || isBusy}
            key={step}
            onClick={() => {
              setCurrentStep(index);
              setStepError("");
            }}
          >
            <span>{index + 1}</span>
            <strong>{step}</strong>
          </button>
        ))}
      </nav>

      <div className="wellness-step-status">
        <span>Step {currentStep + 1} of {REPORT_STEPS.length}</span>
        <strong>{REPORT_STEPS[currentStep]}</strong>
      </div>

      {currentStep === 0 && <section className="wellness-form-section">
        <div className="wellness-form-section__heading"><span><ClockIcon /></span><div><h2>Visit details</h2><p>Connect this report to an assigned visit and record arrival information.</p></div></div>
        <div className="form-grid">
          {assignments.length === 1 ? (
            <div className="wellness-assignment-summary field--wide">
              <span>Reporting care for</span>
              <strong>
                {assignments[0].elderly.preferredName || assignments[0].elderly.fullName}
              </strong>
              <small>
                {humanize(assignments[0].assignmentType)}
                {" · "}
                {new Date(assignments[0].startsAt).toLocaleDateString("en-GB")}
              </small>
            </div>
          ) : (
            <label className="field field--wide" htmlFor="report-assignment">
              <span>Assigned care visit</span>
              <select
                id="report-assignment"
                className={errors.careAssignmentId ? "input input--error" : "input"}
                value={value.careAssignmentId}
                onChange={handleAssignmentChange}
                disabled={Boolean(report)}
              >
                <option value="">Choose an assigned visit</option>
                {assignments.map((assignment) => (
                  <option value={assignment.id} key={assignment.id}>
                    {assignment.elderly.preferredName || assignment.elderly.fullName}
                    {" · "}
                    {humanize(assignment.assignmentType)}
                    {" · "}
                    {new Date(assignment.startsAt).toLocaleDateString("en-GB")}
                  </option>
                ))}
              </select>
              {errors.careAssignmentId && (
                <small className="field__error">{errors.careAssignmentId}</small>
              )}
            </label>
          )}
          <ReportDateField
            value={value.visitDate}
            error={errors.visitDate}
            disabled={isBusy}
            onChange={handleChange}
          />
          <ReportDateTimeField
            id="report-check-in"
            name="checkInAt"
            label="Check-in date and time"
            value={value.checkInAt}
            error={errors.checkInAt}
            disabled={isBusy}
            onChange={handleChange}
          />
          <ReportDateTimeField
            id="report-check-out"
            name="checkOutAt"
            label="Check-out date and time"
            value={value.checkOutAt}
            error={errors.checkOutAt}
            disabled={isBusy}
            onChange={handleChange}
          />
        </div>
        <details
          className="progressive-details wellness-extra-details"
          defaultOpen={Boolean(value.nextVisitDate || errors.nextVisitDate)}
        >
          <summary>Add a future visit date</summary>
          <div className="progressive-details__content">
            <Input
              id="report-next-visit"
              name="nextVisitDate"
              type="datetime-local"
              label="Next visit"
              value={value.nextVisitDate}
              onChange={handleChange}
              error={errors.nextVisitDate}
            />
          </div>
        </details>
      </section>}

      {currentStep === 1 && <section className="wellness-form-section">
        <div className="wellness-form-section__heading">
          <span><ActivityIcon /></span>
          <div>
            <h2>Daily care check-in</h2>
            <p>Use the quick choices, then add one short observation.</p>
          </div>
        </div>
        <div className="wellness-quick-grid">
          <ChoiceField
            label="Mood"
            value={value.mood}
            options={MOODS}
            error={errors.mood}
            onChange={(mood) => {
              setValue((current) => ({ ...current, mood }));
            }}
          />
          <ChoiceField
            label="Meals"
            value={value.mealStatus}
            options={MEAL_STATUSES}
            error={errors.mealStatus}
            onChange={(mealStatus) => {
              setValue((current) => ({ ...current, mealStatus }));
            }}
          />
          <ChoiceField
            label="Medicine"
            value={value.medicineIntakeStatus}
            options={MEDICINE_STATUSES}
            error={errors.medicineIntakeStatus}
            onChange={(medicineIntakeStatus) => {
              setValue((current) => ({ ...current, medicineIntakeStatus }));
            }}
          />
        </div>
        <label className="field" htmlFor="report-observations">
          <span>What did you notice today?</span>
          <textarea
            id="report-observations"
            name="observations"
            className={errors.observations ? "input textarea input--error" : "input textarea"}
            value={value.observations}
            onChange={handleChange}
            placeholder="For example: alert, comfortable, and walking normally."
            required
          />
          {errors.observations && (
            <small className="field__error">{errors.observations}</small>
          )}
        </label>
        {(value.mealStatus === "partial" || value.mealStatus === "missed") && (
          <label className="field" htmlFor="report-meal-notes">
            <span>What happened with the meal?</span>
            <textarea
              id="report-meal-notes"
              name="mealNotes"
              className="input textarea"
              value={value.mealNotes}
              onChange={handleChange}
            />
          </label>
        )}
        {(value.medicineIntakeStatus === "partially-taken"
          || value.medicineIntakeStatus === "missed") && (
          <label className="field" htmlFor="report-medicine-notes">
            <span>What happened with the medicine?</span>
            <textarea
              id="report-medicine-notes"
              name="medicineNotes"
              className="input textarea"
              value={value.medicineNotes}
              onChange={handleChange}
            />
          </label>
        )}
        <details
          className="progressive-details wellness-extra-details"
          defaultOpen={Boolean(
            value.exerciseDurationMinutes
            || value.vitals.systolic
            || value.vitals.diastolic
            || value.vitals.bloodSugar
            || value.vitals.weightKg
            || errors["vitals.systolic"]
            || errors["vitals.diastolic"]
            || errors["vitals.bloodSugar"]
            || errors["vitals.weightKg"]
          )}
        >
          <summary>Add exercise or vital measurements</summary>
          <div className="progressive-details__content">
            <div className="form-grid wellness-vitals-grid">
              <Input id="report-exercise" name="exerciseDurationMinutes" type="number" min="0" max="600" label="Exercise duration (minutes)" value={value.exerciseDurationMinutes} onChange={handleChange} error={errors.exerciseDurationMinutes} />
              <Input id="report-systolic" type="number" min="50" max="260" label="Systolic (mmHg)" value={value.vitals.systolic} onChange={(event) => handleVitalChange("systolic", event.target.value)} error={errors["vitals.systolic"]} />
              <Input id="report-diastolic" type="number" min="30" max="180" label="Diastolic (mmHg)" value={value.vitals.diastolic} onChange={(event) => handleVitalChange("diastolic", event.target.value)} error={errors["vitals.diastolic"]} />
              <Input id="report-blood-sugar" type="number" min="20" max="600" step="0.1" label="Blood sugar (mg/dL)" value={value.vitals.bloodSugar} onChange={(event) => handleVitalChange("bloodSugar", event.target.value)} error={errors["vitals.bloodSugar"]} />
              <SelectField id="report-sugar-context" label="Blood sugar context" value={value.vitals.bloodSugarContext} options={BLOOD_SUGAR_CONTEXTS} placeholder="Choose measurement context" error={errors["vitals.bloodSugarContext"]} onChange={(event) => handleVitalChange("bloodSugarContext", event.target.value)} />
              <Input id="report-weight" type="number" min="20" max="300" step="0.1" label="Weight (kg)" value={value.vitals.weightKg} onChange={(event) => handleVitalChange("weightKg", event.target.value)} error={errors["vitals.weightKg"]} />
              <Input id="report-measured-at" type="datetime-local" label="Measurements taken at" value={value.vitals.measuredAt} onChange={(event) => handleVitalChange("measuredAt", event.target.value)} error={errors["vitals.measuredAt"]} />
            </div>
          </div>
        </details>
      </section>}

      {currentStep === 2 && <section className="wellness-form-section">
        <div className="wellness-form-section__heading"><span><BloodIcon /></span><div><h2>Caregiver handoff</h2><p>Add useful context for the family or the next care visit.</p></div></div>
        <div className="wellness-review-summary">
          <h3>Report summary</h3>
          <div><span>Visit date</span><strong>{value.visitDate || "Not added"}</strong></div>
          <div><span>Mood</span><strong>{value.mood ? humanize(value.mood) : "Not added"}</strong></div>
          <div><span>Meal</span><strong>{value.mealStatus ? humanize(value.mealStatus) : "Not added"}</strong></div>
          <div><span>Medicine</span><strong>{value.medicineIntakeStatus ? humanize(value.medicineIntakeStatus) : "Not added"}</strong></div>
          <div><span>Observations</span><strong>{value.observations || "Not added"}</strong></div>
        </div>
        <details
          className="progressive-details wellness-extra-details"
          defaultOpen={Boolean(value.caregiverNotes)}
        >
          <summary>Add a handoff note</summary>
          <div className="progressive-details__content">
            <label className="field" htmlFor="report-caregiver-notes">
              <span>Handoff note</span>
              <textarea
                id="report-caregiver-notes"
                name="caregiverNotes"
                className="input textarea"
                value={value.caregiverNotes}
                onChange={handleChange}
                placeholder="Instructions or follow-up information for the family."
              />
            </label>
          </div>
        </details>
      </section>}

      {stepError && <div className="alert alert--error">{stepError}</div>}
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
        <span className="wellness-form-actions__navigation">
          {currentStep > 0 && (
            <Button type="button" variant="secondary" disabled={isBusy} onClick={openPreviousStep}>
              <ArrowLeftIcon size={18} />
              Back
            </Button>
          )}
          {currentStep < REPORT_STEPS.length - 1 ? (
            <Button type="button" disabled={isBusy} onClick={openNextStep}>
              Next
              <ArrowRightIcon size={18} />
            </Button>
          ) : (
            <Button type="submit" isLoading={isBusy}>
              <SendIcon size={18} />
              Submit report
            </Button>
          )}
        </span>
      </div>
    </form>
  );
}
