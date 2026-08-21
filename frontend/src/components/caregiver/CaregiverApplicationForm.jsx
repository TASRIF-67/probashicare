import { useEffect, useRef, useState } from "react";
import { Button } from "../Button.jsx";
import { Input } from "../Input.jsx";
import {
  CloseIcon,
  FileCheckIcon,
  PlusIcon,
  SaveIcon,
  UploadIcon,
} from "../Icons.jsx";

const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const APPLICATION_STEPS = [
  {
    label: "Profile",
    description: "Experience and skills",
  },
  {
    label: "Work details",
    description: "Rates and service area",
  },
  {
    label: "Availability",
    description: "Working days and hours",
  },
  {
    label: "Verification",
    description: "Identity document",
  },
];

const COMMON_SKILLS = [
  "Personal care",
  "Medication support",
  "Mobility support",
  "Meal preparation",
  "Companionship",
  "Vitals monitoring",
];

const COMMON_LANGUAGES = [
  "Bangla",
  "English",
  "Hindi",
  "Urdu",
];

const EMPTY_APPLICATION = {
  phone: "",
  bio: "",
  skills: [],
  languages: [],
  yearsOfExperience: "",
  hourlyRate: "",
  monthlyRate: "",
  serviceArea: "",
  availability: [],
};

/**
 * Creates a new blank caregiver application value.
 * @returns {Record<string, unknown>} Independent form value with new arrays.
 * @sideEffects None.
 */
function createEmptyApplication() {
  return {
    ...EMPTY_APPLICATION,
    skills: [],
    languages: [],
    availability: [],
  };
}

/**
 * Converts an API application into editable form values.
 * @param {Record<string, unknown>|null} application - Existing caregiver application.
 * @returns {Record<string, unknown>} Form-safe application fields.
 * @sideEffects None.
 */
function toFormValue(application) {
  if (!application) {
    return createEmptyApplication();
  }

  return {
    ...EMPTY_APPLICATION,
    ...application,
    yearsOfExperience: application.yearsOfExperience ?? "",
    hourlyRate: application.hourlyRate ?? "",
    monthlyRate: application.monthlyRate ?? "",
    skills: application.skills || [],
    languages: application.languages || [],
    availability: application.availability || [],
  };
}

/**
 * Converts stored tag arrays into editable comma-separated text.
 * @param {Record<string, unknown>|null} application - Existing caregiver application.
 * @returns {{skills: string, languages: string}} Editable tag text.
 * @sideEffects None.
 */
function toTagText(application) {
  const skills = application?.skills || [];
  const languages = application?.languages || [];

  return {
    skills: skills.join(", "),
    languages: languages.join(", "),
  };
}

/**
 * Converts comma-separated text into non-empty trimmed values.
 * @param {string} text - Text entered by the caregiver.
 * @returns {string[]} Clean skill or language values.
 * @sideEffects None.
 */
function splitTagText(text) {
  const values = [];
  const pieces = text.split(",");

  for (const piece of pieces) {
    const trimmedPiece = piece.trim();

    if (trimmedPiece) {
      values.push(trimmedPiece);
    }
  }

  return values;
}

/**
 * Formats a weekday for visible select options.
 * @param {string} day - Lowercase weekday value.
 * @returns {string} Weekday with an uppercase first letter.
 * @sideEffects None.
 */
function formatWeekday(day) {
  return day.charAt(0).toUpperCase() + day.slice(1);
}

/**
 * Finds the application step containing the first server validation error.
 * @param {Record<string, string>} errors - Field errors returned by the API.
 * @param {boolean} approvedMode - Whether the form edits an approved profile.
 * @returns {number} Matching step index, or -1 for no field-specific error.
 * @sideEffects None.
 */
function findErrorStep(errors, approvedMode) {
  for (const fieldName in errors) {
    if (
      fieldName === "phone"
      || fieldName === "bio"
      || fieldName === "skills"
      || fieldName === "languages"
      || fieldName === "yearsOfExperience"
    ) {
      return 0;
    }

    if (
      fieldName === "hourlyRate"
      || fieldName === "monthlyRate"
      || fieldName === "serviceArea"
    ) {
      return 1;
    }

    if (fieldName.startsWith("availability")) {
      return 2;
    }

    if (!approvedMode && fieldName === "verificationDocument") {
      return 3;
    }
  }

  return -1;
}

/**
 * Displays common skills or languages as quick multi-select buttons.
 * @param {{label: string, options: string[], selectedValues: string[], onToggle: (value: string) => void}} props - Choice labels, state, and handler.
 * @returns {import("react").ReactElement} Accessible multi-select choice group.
 * @sideEffects Invokes the supplied toggle handler.
 */
function TagChoices({ label, options, selectedValues, onToggle }) {
  return (
    <fieldset className="application-tag-choices field--wide">
      <legend>{label}</legend>
      <div>
        {options.map((option) => {
          const selected = selectedValues.includes(option);
          return (
            <button
              type="button"
              className={selected ? "is-selected" : ""}
              aria-pressed={selected}
              key={option}
              onClick={() => {
                onToggle(option);
              }}
            >
              {option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Renders the caregiver application and approved-profile editor.
 * @param {{application: object, errors?: object, isBusy?: boolean, approvedMode?: boolean, onSaveDraft?: Function, onSubmitApplication?: Function, onUpdateApproved?: Function}} props - Application data and actions.
 * @returns {import("react").ReactElement} Guided caregiver application form.
 * @sideEffects Manages form/file/step state and invokes supplied async actions.
 */
export function CaregiverApplicationForm({
  application,
  errors = {},
  isBusy = false,
  approvedMode = false,
  onSaveDraft,
  onSubmitApplication,
  onUpdateApproved,
}) {
  const formRef = useRef(null);
  const [value, setValue] = useState(() => toFormValue(application));
  const [tagText, setTagText] = useState(() => toTagText(application));
  const [documentFile, setDocumentFile] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  let steps = APPLICATION_STEPS.slice(0, 3);

  if (!approvedMode && application.isVerificationDocumentRequired) {
    steps = APPLICATION_STEPS;
  }
  const lastStepIndex = steps.length - 1;
  let submitLabel = "Submit for review";

  if (approvedMode) {
    submitLabel = "Save profile";
  } else if (application.applicationStatus === "rejected") {
    submitLabel = "Resubmit";
  }

  useEffect(() => {
    setValue(toFormValue(application));
    setTagText(toTagText(application));
    setDocumentFile(null);
    setCurrentStep(0);
  }, [application]);

  useEffect(() => {
    const errorStep = findErrorStep(errors, approvedMode);

    if (errorStep >= 0) {
      setCurrentStep(errorStep);
    }
  }, [approvedMode, errors]);

  /**
   * Updates a scalar application field.
   * @param {import("react").ChangeEvent<HTMLInputElement|HTMLTextAreaElement>} event - Changed field event.
   * @returns {void}
   * @sideEffects Updates component form state.
   */
  function handleChange(event) {
    const fieldName = event.target.name;
    const nextValue = event.target.value;

    setValue(function updateApplication(current) {
      return {
        ...current,
        [fieldName]: nextValue,
      };
    });
  }

  /**
   * Converts a comma-separated tag field into a normalized string array.
   * @param {"skills"|"languages"} field - Array field to update.
   * @param {string} text - Comma-separated user input.
   * @returns {void}
   * @sideEffects Updates tag text and component form state.
   */
  function handleTags(field, text) {
    setTagText(function updateTagText(current) {
      return {
        ...current,
        [field]: text,
      };
    });

    setValue(function updateApplicationTags(current) {
      return {
        ...current,
        [field]: splitTagText(text),
      };
    });
  }

  /**
   * Adds or removes one common skill or language without requiring typing.
   * @param {"skills"|"languages"} field - Application array to update.
   * @param {string} selectedValue - Skill or language selected by the caregiver.
   * @returns {void}
   * @sideEffects Updates tag text and application form state.
   */
  function toggleTag(field, selectedValue) {
    const nextValues = [];
    let wasSelected = false;

    for (const currentValue of value[field]) {
      if (currentValue === selectedValue) {
        wasSelected = true;
      } else {
        nextValues.push(currentValue);
      }
    }

    if (!wasSelected) {
      nextValues.push(selectedValue);
    }

    setValue(function updateApplicationTags(current) {
      return {
        ...current,
        [field]: nextValues,
      };
    });
    setTagText(function updateVisibleTagText(current) {
      return {
        ...current,
        [field]: nextValues.join(", "),
      };
    });
  }

  /**
   * Updates one availability field without mutating existing rows.
   * @param {number} index - Availability entry position.
   * @param {string} field - Entry field name.
   * @param {string} nextValue - New field value.
   * @returns {void}
   * @sideEffects Updates component form state.
   */
  function updateAvailability(index, field, nextValue) {
    setValue(function updateAvailabilityRows(current) {
      const nextAvailability = [];

      for (let entryIndex = 0; entryIndex < current.availability.length; entryIndex += 1) {
        const entry = current.availability[entryIndex];

        if (entryIndex === index) {
          nextAvailability.push({
            ...entry,
            [field]: nextValue,
          });
        } else {
          nextAvailability.push(entry);
        }
      }

      return {
        ...current,
        availability: nextAvailability,
      };
    });
  }

  /**
   * Adds one standard availability period.
   * @returns {void}
   * @sideEffects Adds a Monday 09:00–17:00 row to form state.
   */
  function addAvailabilityPeriod() {
    setValue(function addPeriod(current) {
      return {
        ...current,
        availability: [
          ...current.availability,
          {
            day: "monday",
            startTime: "09:00",
            endTime: "17:00",
          },
        ],
      };
    });
  }

  /**
   * Adds missing Monday-to-Friday rows with standard daytime hours.
   * @returns {void}
   * @sideEffects Updates availability form state.
   */
  function addWeekdaySchedule() {
    const standardWeekdays = WEEKDAYS.slice(0, 5);

    setValue(function addMissingWeekdays(current) {
      const nextAvailability = [...current.availability];

      for (const weekday of standardWeekdays) {
        let alreadyExists = false;

        for (const entry of current.availability) {
          if (entry.day === weekday) {
            alreadyExists = true;
            break;
          }
        }

        if (!alreadyExists) {
          nextAvailability.push({
            day: weekday,
            startTime: "09:00",
            endTime: "17:00",
          });
        }
      }

      return {
        ...current,
        availability: nextAvailability,
      };
    });
  }

  /**
   * Removes one availability row while preserving all other rows.
   * @param {number} index - Availability entry position.
   * @returns {void}
   * @sideEffects Updates component form state.
   */
  function removeAvailability(index) {
    setValue(function removePeriod(current) {
      const nextAvailability = [];

      for (let entryIndex = 0; entryIndex < current.availability.length; entryIndex += 1) {
        if (entryIndex !== index) {
          nextAvailability.push(current.availability[entryIndex]);
        }
      }

      return {
        ...current,
        availability: nextAvailability,
      };
    });
  }

  /**
   * Displays browser validation for the first invalid control in one step.
   * @param {number} stepIndex - Step that should be validated.
   * @returns {boolean} True when every control in the step is valid.
   * @sideEffects May change the active step and focus an invalid field.
   */
  function validateStep(stepIndex) {
    const section = formRef.current?.querySelector(
      `[data-application-step="${stepIndex}"]`,
    );

    if (!section) {
      return true;
    }

    const controls = section.querySelectorAll("input, select, textarea");

    for (const control of controls) {
      if (!control.checkValidity()) {
        setCurrentStep(stepIndex);

        const collapsedDetails = control.closest("details");

        if (collapsedDetails) {
          collapsedDetails.open = true;
        }

        /**
         * Focuses the invalid control after React reveals its step.
         * @returns {void}
         * @sideEffects Moves focus and opens the browser validation message.
         */
        function showValidationMessage() {
          control.focus();
          control.reportValidity();
        }

        window.setTimeout(showValidationMessage, 0);
        return false;
      }
    }

    return true;
  }

  /**
   * Opens a selected application step.
   * @param {number} stepIndex - Step position selected by the user.
   * @returns {void}
   * @sideEffects Updates current step state.
   */
  function openStep(stepIndex) {
    setCurrentStep(stepIndex);
  }

  /**
   * Validates the current step and advances when it is complete.
   * @returns {void}
   * @sideEffects May display validation or update current step state.
   */
  function openNextStep() {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  }

  /**
   * Returns to the previous application step.
   * @returns {void}
   * @sideEffects Updates current step state.
   */
  function openPreviousStep() {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }

  /**
   * Saves the current application as a draft without requiring all steps.
   * @returns {Promise<void>}
   * @sideEffects Calls the supplied draft action.
   */
  async function saveDraft() {
    if (onSaveDraft) {
      await onSaveDraft(value, documentFile);
    }
  }

  /**
   * Validates all steps and invokes the relevant final action.
   * @param {import("react").FormEvent<HTMLFormElement>} event - Form submission event.
   * @returns {Promise<void>}
   * @sideEffects May focus validation errors or call a supplied API action.
   */
  async function handleSubmit(event) {
    event.preventDefault();

    if (currentStep < lastStepIndex) {
      openNextStep();
      return;
    }

    for (let stepIndex = 0; stepIndex <= lastStepIndex; stepIndex += 1) {
      if (!validateStep(stepIndex)) {
        return;
      }
    }

    if (approvedMode && onUpdateApproved) {
      await onUpdateApproved(value);
    } else if (onSubmitApplication) {
      await onSubmitApplication(value, documentFile);
    }
  }

  return (
    <form
      ref={formRef}
      className="caregiver-application-form caregiver-application-wizard"
      noValidate
      onSubmit={handleSubmit}
    >
      <nav className="application-wizard-progress" aria-label="Application progress">
        <div className="application-wizard-progress__summary">
          <span>Step {currentStep + 1} of {steps.length}</span>
          <strong>{steps[currentStep].label}</strong>
          <small>{steps[currentStep].description}</small>
        </div>
        <ol>
          {steps.map((step, stepIndex) => (
            <li key={step.label}>
              <button
                type="button"
                className={
                  stepIndex === currentStep
                    ? "application-wizard-step application-wizard-step--active"
                    : "application-wizard-step"
                }
                aria-current={stepIndex === currentStep ? "step" : undefined}
                onClick={() => openStep(stepIndex)}
              >
                <span>{stepIndex + 1}</span>
                <strong>{step.label}</strong>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {errors.form && (
        <div className="alert alert--error" role="alert">
          {errors.form}
        </div>
      )}

      <section
        className="application-section"
        data-application-step="0"
        hidden={currentStep !== 0}
      >
        <div className="application-section__heading">
          <span>01</span>
          <div>
            <h2>Professional profile</h2>
            <p>Tell families about your experience and the care you provide.</p>
          </div>
        </div>
        <div className="form-grid">
          <Input
            id="caregiver-phone"
            name="phone"
            type="tel"
            label="Phone number"
            value={value.phone}
            onChange={handleChange}
            error={errors.phone}
            required
          />
          <Input
            id="caregiver-experience"
            name="yearsOfExperience"
            type="number"
            min="0"
            max="60"
            label="Years of experience"
            value={value.yearsOfExperience}
            onChange={handleChange}
            error={errors.yearsOfExperience}
            required
          />
          <label className="field field--wide" htmlFor="caregiver-bio">
            <span>Short bio</span>
            <textarea
              id="caregiver-bio"
              className={errors.bio ? "input textarea input--error" : "input textarea"}
              name="bio"
              value={value.bio}
              onChange={handleChange}
              placeholder="Describe your caregiving background and approach"
              required
            />
            {errors.bio && <small className="field__error">{errors.bio}</small>}
          </label>
          <TagChoices
            label="Select your care skills"
            options={COMMON_SKILLS}
            selectedValues={value.skills}
            onToggle={(skill) => {
              toggleTag("skills", skill);
            }}
          />
          <TagChoices
            label="Select languages you speak"
            options={COMMON_LANGUAGES}
            selectedValues={value.languages}
            onToggle={(language) => {
              toggleTag("languages", language);
            }}
          />
          <details
            className="progressive-details field--wide"
            defaultOpen={!value.skills.length || !value.languages.length}
          >
            <summary>Add a skill or language not listed</summary>
            <div className="form-grid progressive-details__content">
              <Input
                id="caregiver-skills"
                label="Skills"
                value={tagText.skills}
                onChange={(event) => handleTags("skills", event.target.value)}
                error={errors.skills}
                hint="Separate multiple skills with commas."
                required
              />
              <Input
                id="caregiver-languages"
                label="Languages"
                value={tagText.languages}
                onChange={(event) => handleTags("languages", event.target.value)}
                error={errors.languages}
                hint="Separate multiple languages with commas."
                required
              />
            </div>
          </details>
        </div>
      </section>

      <section
        className="application-section"
        data-application-step="1"
        hidden={currentStep !== 1}
      >
        <div className="application-section__heading">
          <span>02</span>
          <div>
            <h2>Rates and service area</h2>
            <p>Set clear rates in BDT and describe where you can work.</p>
          </div>
        </div>
        <div className="form-grid">
          <Input
            id="hourly-rate"
            name="hourlyRate"
            type="number"
            min="0"
            label="Hourly rate (BDT)"
            value={value.hourlyRate}
            onChange={handleChange}
            error={errors.hourlyRate}
            required
          />
          <Input
            id="monthly-rate"
            name="monthlyRate"
            type="number"
            min="0"
            label="Monthly rate (BDT)"
            value={value.monthlyRate}
            onChange={handleChange}
            error={errors.monthlyRate}
            required
          />
          <Input
            id="service-area"
            name="serviceArea"
            label="Service area"
            value={value.serviceArea}
            onChange={handleChange}
            error={errors.serviceArea}
            hint="Use familiar neighborhoods, areas, or districts."
            placeholder="For example, Dhanmondi and nearby areas"
            required
          />
        </div>
      </section>

      <section
        className="application-section"
        data-application-step="2"
        hidden={currentStep !== 2}
      >
        <div className="application-section__heading application-section__heading--action">
          <div className="application-section__heading-main">
            <span>03</span>
            <div>
              <h2>Availability</h2>
              <p>Add the days and time periods you are normally available.</p>
            </div>
          </div>
          <div className="application-availability-actions">
            <Button type="button" variant="ghost" onClick={addWeekdaySchedule}>
              Add weekdays 9–5
            </Button>
            <Button type="button" variant="secondary" onClick={addAvailabilityPeriod}>
              <PlusIcon size={17} />
              Add period
            </Button>
          </div>
        </div>
        {value.availability.length === 0 && (
          <div className="empty-state application-availability-empty">
            <strong>No working hours added yet</strong>
            <span>Use the weekday shortcut or add one period manually.</span>
          </div>
        )}
        <div className="availability-list">
          {value.availability.map((entry, index) => (
            <div className="availability-row" key={entry._id || index}>
              <label className="field">
                <span>Day</span>
                <select
                  className="input"
                  value={entry.day}
                  onChange={(event) => updateAvailability(index, "day", event.target.value)}
                >
                  {WEEKDAYS.map((day) => (
                    <option value={day} key={day}>
                      {formatWeekday(day)}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                id={`start-${index}`}
                type="time"
                label="Start"
                value={entry.startTime}
                onChange={(event) => updateAvailability(index, "startTime", event.target.value)}
                error={errors[`availability.${index}.startTime`]}
                required
              />
              <Input
                id={`end-${index}`}
                type="time"
                label="End"
                value={entry.endTime}
                onChange={(event) => updateAvailability(index, "endTime", event.target.value)}
                error={errors[`availability.${index}.endTime`]}
                required
              />
              <button
                className="icon-button"
                type="button"
                aria-label={`Remove availability period ${index + 1}`}
                onClick={() => removeAvailability(index)}
              >
                <CloseIcon size={17} />
              </button>
            </div>
          ))}
        </div>
        {errors.availability && (
          <div className="alert alert--error">{errors.availability}</div>
        )}
      </section>

      {!approvedMode && application.isVerificationDocumentRequired && (
        <section
          className="application-section"
          data-application-step="3"
          hidden={currentStep !== 3}
        >
          <div className="application-section__heading">
            <span>04</span>
            <div>
              <h2>Verification document</h2>
              <p>Upload one ID or verification document. PDF, JPG, or PNG up to 5 MB.</p>
            </div>
          </div>
          <label className="document-drop">
            <UploadIcon size={26} />
            <strong>
              {documentFile ? documentFile.name : "Choose verification document"}
            </strong>
            <span>
              {application.verificationDocument?.originalName
                ? `Current: ${application.verificationDocument.originalName}`
                : "PDF, JPG, or PNG up to 5 MB"}
            </span>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={(event) => setDocumentFile(event.target.files?.[0] || null)}
            />
          </label>
          {application.verificationDocument?.publicId && (
            <div className="document-ready">
              <FileCheckIcon size={18} />
              Verification document uploaded
            </div>
          )}
          {errors.verificationDocument && (
            <div className="alert alert--error">
              {errors.verificationDocument}
            </div>
          )}
        </section>
      )}

      <div className="application-actions application-wizard-actions">
        <div className="application-wizard-actions__status">
          <strong>{steps[currentStep].label}</strong>
          <span>{currentStep + 1} of {steps.length}</span>
        </div>
        <div className="application-wizard-actions__buttons">
          {!approvedMode && (
            <Button
              type="button"
              variant="ghost"
              isLoading={isBusy}
              onClick={saveDraft}
            >
              <SaveIcon size={18} />
              Save draft
            </Button>
          )}
          {currentStep > 0 && (
            <Button
              type="button"
              variant="secondary"
              disabled={isBusy}
              onClick={openPreviousStep}
            >
              Back
            </Button>
          )}
          {currentStep < lastStepIndex ? (
            <Button type="button" disabled={isBusy} onClick={openNextStep}>
              Continue
            </Button>
          ) : (
            <Button type="submit" isLoading={isBusy}>
              <FileCheckIcon size={18} />
              {submitLabel}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
