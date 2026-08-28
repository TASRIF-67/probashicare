import { useEffect, useState } from "react";
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
  { key: "health", label: "Health" },
  { key: "emergencyContacts", label: "Emergency" },
  { key: "review", label: "Review" },
];

const FAMILY_RELATIONSHIPS = [
  "Daughter",
  "Son",
  "Spouse",
  "Granddaughter",
  "Grandson",
  "Sister",
  "Brother",
  "Niece",
  "Nephew",
  "Other",
];

const PREFERRED_LANGUAGES = [
  "Bangla",
  "English",
  "Hindi",
  "Urdu",
  "Other",
];

const BANGLADESH_DIVISIONS = [
  "Barishal",
  "Chattogram",
  "Dhaka",
  "Khulna",
  "Mymensingh",
  "Rajshahi",
  "Rangpur",
  "Sylhet",
];

const BANGLADESH_DISTRICTS = [
  "Bagerhat",
  "Bandarban",
  "Barguna",
  "Barishal",
  "Bhola",
  "Bogura",
  "Brahmanbaria",
  "Chandpur",
  "Chapainawabganj",
  "Chattogram",
  "Chuadanga",
  "Cox's Bazar",
  "Cumilla",
  "Dhaka",
  "Dinajpur",
  "Faridpur",
  "Feni",
  "Gaibandha",
  "Gazipur",
  "Gopalganj",
  "Habiganj",
  "Jamalpur",
  "Jashore",
  "Jhalokati",
  "Jhenaidah",
  "Joypurhat",
  "Khagrachhari",
  "Khulna",
  "Kishoreganj",
  "Kurigram",
  "Kushtia",
  "Lakshmipur",
  "Lalmonirhat",
  "Madaripur",
  "Magura",
  "Manikganj",
  "Meherpur",
  "Moulvibazar",
  "Munshiganj",
  "Mymensingh",
  "Naogaon",
  "Narail",
  "Narayanganj",
  "Narsingdi",
  "Natore",
  "Netrokona",
  "Nilphamari",
  "Noakhali",
  "Pabna",
  "Panchagarh",
  "Patuakhali",
  "Pirojpur",
  "Rajbari",
  "Rajshahi",
  "Rangamati",
  "Rangpur",
  "Satkhira",
  "Shariatpur",
  "Sherpur",
  "Sirajganj",
  "Sunamganj",
  "Sylhet",
  "Tangail",
  "Thakurgaon",
];

const DISTRICT_TO_DIVISION = {
  Bagerhat: "Khulna",
  Bandarban: "Chattogram",
  Barguna: "Barishal",
  Barishal: "Barishal",
  Bhola: "Barishal",
  Bogura: "Rajshahi",
  Brahmanbaria: "Chattogram",
  Chandpur: "Chattogram",
  Chapainawabganj: "Rajshahi",
  Chattogram: "Chattogram",
  Chuadanga: "Khulna",
  "Cox's Bazar": "Chattogram",
  Cumilla: "Chattogram",
  Dhaka: "Dhaka",
  Dinajpur: "Rangpur",
  Faridpur: "Dhaka",
  Feni: "Chattogram",
  Gaibandha: "Rangpur",
  Gazipur: "Dhaka",
  Gopalganj: "Dhaka",
  Habiganj: "Sylhet",
  Jamalpur: "Mymensingh",
  Jashore: "Khulna",
  Jhalokati: "Barishal",
  Jhenaidah: "Khulna",
  Joypurhat: "Rajshahi",
  Khagrachhari: "Chattogram",
  Khulna: "Khulna",
  Kishoreganj: "Dhaka",
  Kurigram: "Rangpur",
  Kushtia: "Khulna",
  Lakshmipur: "Chattogram",
  Lalmonirhat: "Rangpur",
  Madaripur: "Dhaka",
  Magura: "Khulna",
  Manikganj: "Dhaka",
  Meherpur: "Khulna",
  Moulvibazar: "Sylhet",
  Munshiganj: "Dhaka",
  Mymensingh: "Mymensingh",
  Naogaon: "Rajshahi",
  Narail: "Khulna",
  Narayanganj: "Dhaka",
  Narsingdi: "Dhaka",
  Natore: "Rajshahi",
  Netrokona: "Mymensingh",
  Nilphamari: "Rangpur",
  Noakhali: "Chattogram",
  Pabna: "Rajshahi",
  Panchagarh: "Rangpur",
  Patuakhali: "Barishal",
  Pirojpur: "Barishal",
  Rajbari: "Dhaka",
  Rajshahi: "Rajshahi",
  Rangamati: "Chattogram",
  Rangpur: "Rangpur",
  Satkhira: "Khulna",
  Shariatpur: "Dhaka",
  Sherpur: "Mymensingh",
  Sirajganj: "Rajshahi",
  Sunamganj: "Sylhet",
  Sylhet: "Sylhet",
  Tangail: "Dhaka",
  Thakurgaon: "Rangpur",
};

const MEDICINE_FORMS = [
  "tablet",
  "capsule",
  "syrup",
  "injection",
  "inhaler",
  "drops",
  "cream",
  "ointment",
  "other",
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
    {
      key: "condition",
      label: "Condition or event",
      type: "text",
      required: true,
    },
    {
      key: "diagnosisDate",
      label: "Diagnosis date",
      type: "date",
    },
    {
      key: "treatmentSummary",
      label: "Treatment summary",
      type: "text",
    },
    {
      key: "hospitalOrDoctor",
      label: "Hospital or doctor",
      type: "text",
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: ["active", "recovered", "managed", "unknown"],
    },
    {
      key: "notes",
      label: "Notes",
      type: "text",
    },
  ],
  allergies: [
    {
      key: "allergen",
      label: "Allergen",
      type: "text",
      required: true,
    },
    {
      key: "type",
      label: "Type",
      type: "select",
      options: ["medicine", "food", "environmental", "other"],
    },
    {
      key: "reaction",
      label: "Reaction",
      type: "text",
    },
    {
      key: "severity",
      label: "Severity",
      type: "select",
      options: ["mild", "moderate", "severe", "unknown"],
    },
    {
      key: "notes",
      label: "Notes",
      type: "text",
    },
  ],
  chronicDiseases: [
    {
      key: "name",
      label: "Disease name",
      type: "text",
      required: true,
    },
    {
      key: "diagnosisDate",
      label: "Diagnosis date",
      type: "date",
    },
    {
      key: "managingDoctor",
      label: "Managing doctor",
      type: "text",
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: ["active", "recovered", "managed", "unknown"],
    },
    {
      key: "notes",
      label: "Notes",
      type: "text",
    },
  ],
  medications: [
    {
      key: "name",
      label: "Medicine name",
      type: "text",
      required: true,
    },
    {
      key: "strength",
      label: "Strength",
      type: "text",
    },
    {
      key: "dosage",
      label: "Dosage",
      type: "text",
    },
    {
      key: "form",
      label: "Form",
      type: "select",
      options: MEDICINE_FORMS,
    },
    {
      key: "reason",
      label: "Reason",
      type: "text",
    },
    {
      key: "prescribingDoctor",
      label: "Prescribing doctor",
      type: "text",
    },
    {
      key: "startDate",
      label: "Start date",
      type: "date",
    },
    {
      key: "endDate",
      label: "End date",
      type: "date",
    },
    {
      key: "notes",
      label: "Notes",
      type: "text",
    },
  ],
  emergencyContacts: [
    {
      key: "name",
      label: "Contact name",
      type: "text",
      required: true,
    },
    {
      key: "relationship",
      label: "Relationship",
      type: "select",
      required: true,
      options: FAMILY_RELATIONSHIPS,
    },
    {
      key: "phone",
      label: "Phone",
      type: "tel",
      required: true,
    },
    {
      key: "alternativePhone",
      label: "Alternative phone",
      type: "tel",
    },
    {
      key: "address",
      label: "Address",
      type: "text",
    },
    {
      key: "priority",
      label: "Priority",
      type: "number",
    },
  ],
};
/**
 * Creates a clean form value from an API profile or the empty template.
 * @param {Record<string, unknown>|null} profile - Existing profile for edit mode.
 * @returns {Record<string, unknown>} Form-safe profile without Mongoose metadata.
 * @sideEffects None.
 */
function createInitialValue(profile) {
  if (!profile) {
    // The object spread creates a new personal-information object. New empty
    // arrays ensure form edits never change the shared EMPTY_PROFILE constant.
    return {
      personalInformation: {
        ...EMPTY_PROFILE.personalInformation,
      },
      medicalHistory: [],
      allergies: [],
      medications: [],
      chronicDiseases: [],
      emergencyContacts: [],
    };
  }

  const sectionNames = [
    "medicalHistory",
    "allergies",
    "medications",
    "chronicDiseases",
    "emergencyContacts",
  ];
  const initialValue = {
    personalInformation: {
      ...EMPTY_PROFILE.personalInformation,
      ...profile.personalInformation,
      dateOfBirth: cleanDate(profile.personalInformation.dateOfBirth),
    },
  };

  for (const sectionName of sectionNames) {
    const sourceItems = profile[sectionName] || [];
    const cleanItems = [];

    for (const item of sourceItems) {
      // 'push()' appends one cleaned copy to the new section array.
      cleanItems.push({
        ...item,
        diagnosisDate: cleanDate(item.diagnosisDate),
        startDate: cleanDate(item.startDate),
        endDate: cleanDate(item.endDate),
      });
    }

    initialValue[sectionName] = cleanItems;
  }

  return initialValue;
}

/**
 * Formats an optional stored date for a native date input.
 * @param {string|Date|null|undefined} value - Stored date value.
 * @returns {string} YYYY-MM-DD date text or an empty string.
 * @sideEffects None.
 */
function cleanDate(value) {
  if (!value) {
    return "";
  }

  // 'String()' converts the value to text. 'slice(0, 10)' keeps the first
  // ten characters, which are the YYYY-MM-DD part used by a date input.
  return String(value).slice(0, 10);
}

/**
 * Calculates an approximate age for the form review.
 * @param {string} dateOfBirth - Native date-input value.
 * @returns {number|null} Whole approximate years, or null when no date exists.
 * @sideEffects Reads the current timestamp.
 */
function calculateApproximateAge(dateOfBirth) {
  if (!dateOfBirth) {
    return null;
  }

  // 'new Date()' converts the input text to a Date object.
  const birthDate = new Date(dateOfBirth);

  // 'Date.now()' gives the current timestamp and 'getTime()' gives the birth timestamp.
  const elapsedMilliseconds = Date.now() - birthDate.getTime();
  const approximateYears = elapsedMilliseconds / 31557600000;

  // 'Math.floor()' keeps whole years. 'Math.max()' prevents a negative result.
  return Math.max(
    0,
    Math.floor(approximateYears),
  );
}
/**
 * Returns a blank repeated-section item with sensible enum defaults.
 * @param {string} section - Medical/contact section name.
 * @returns {Record<string, unknown>} New editable item.
 * @sideEffects None.
 */
function createSectionItem(section) {
  if (section === "medicalHistory") {
    return {
      condition: "",
      status: "unknown",
    };
  }

  if (section === "allergies") {
    return {
      allergen: "",
      type: "other",
      severity: "unknown",
    };
  }

  if (section === "chronicDiseases") {
    return {
      name: "",
      status: "active",
    };
  }

  if (section === "medications") {
    return {
      name: "",
      form: "tablet",
      isActive: true,
    };
  }

  return {
    name: "",
    relationship: FAMILY_RELATIONSHIPS[0],
    phone: "",
    priority: 1,
    isPrimary: false,
  };
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
    const updatedItems = [];

    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      const item = items[itemIndex];

      if (itemIndex === index) {
        // 'push()' appends a copied and updated item to the new array.
        updatedItems.push({
          ...item,
          [key]: value,
        });
      } else {
        // Unchanged items are appended without modification.
        updatedItems.push(item);
      }
    }

    onChange(updatedItems);
  }

  /**
   * Adds one blank entry to this repeated section.
   * @returns {void}
   * @sideEffects Calls the parent change callback with a new array.
   */
  function addItem() {
    // The spread copies existing items into a new array. The newly created
    // blank item is then placed at the end of that array.
    const updatedItems = [
      ...items,
      createSectionItem(section),
    ];

    onChange(updatedItems);
  }

  /**
   * Removes one entry by its array position.
   * @param {number} removedIndex - Position of the entry to remove.
   * @returns {void}
   * @sideEffects Calls the parent change callback with a new array.
   */
  function removeItem(removedIndex) {
    const remainingItems = [];

    for (let index = 0; index < items.length; index += 1) {
      if (index !== removedIndex) {
        // 'push()' copies every item except the removed position.
        remainingItems.push(items[index]);
      }
    }

    onChange(remainingItems);
  }

  /**
   * Selects at most one primary emergency contact.
   * @param {number} selectedIndex - Contact whose checkbox changed.
   * @param {boolean} isChecked - New checkbox state.
   * @returns {void}
   * @sideEffects Calls the parent change callback with updated contacts.
   */
  function updatePrimaryContact(selectedIndex, isChecked) {
    const updatedContacts = [];

    for (let index = 0; index < items.length; index += 1) {
      const contact = items[index];
      let isPrimary = false;

      if (index === selectedIndex) {
        isPrimary = isChecked;
      }

      // 'push()' appends a copied contact with its new primary state.
      updatedContacts.push({
        ...contact,
        isPrimary,
      });
    }

    onChange(updatedContacts);
  }

  return (
    <section className="form-section">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <Button type="button" variant="secondary" onClick={addItem}>
          <PlusIcon size={18} />
          Add entry
        </Button>
      </div>
      {!items.length && (
        <div className="empty-state">
          No entries added. You can leave this section empty.
        </div>
      )}
      <div className="repeat-list">
        {/* 'map()' converts every repeated item into one editable React card. */}
        {items.map((item, index) => {
          const itemKey = item._id || section + "-" + index;

          return (
            <article
              className="repeat-card"
              key={itemKey}
            >
              <div className="repeat-card__header">
                <strong>
                  {title}
                  {" "}
                  {index + 1}
                </strong>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    removeItem(index);
                  }}
                >
                  <CloseIcon size={17} />
                  Remove
                </Button>
              </div>

              <div className="form-grid">
                {/* This 'map()' creates one field from each readable field definition. */}
                {SECTION_FIELDS[section].map((field) => {
                  const key = field.key;
                  const label = field.label;
                  const type = field.type || "text";
                  const required = field.required || false;
                  const options = field.options || [];
                  const errorKey =
                    section
                    + "."
                    + index
                    + "."
                    + key;
                  const fieldError = errors[errorKey];

                  let inputClassName = "input";

                  if (fieldError) {
                    inputClassName = "input input--error";
                  }

                  if (type === "select") {
                    const currentValue =
                      item[key]
                      || options[0];

                    // 'includes()' checks whether the saved value is already one
                    // of the current choices.
                    const hasCustomOption =
                      item[key]
                      && !options.includes(item[key]);

                    return (
                      <label
                        className="field"
                        key={key}
                      >
                        <span>{label}</span>

                        <select
                          className="input"
                          value={currentValue}
                          onChange={(event) => {
                            updateItem(
                              index,
                              key,
                              event.target.value,
                            );
                          }}
                        >
                          {hasCustomOption && (
                            <option value={item[key]}>
                              {item[key]}
                            </option>
                          )}

                          {/* 'map()' converts each allowed value to an option. */}
                          {options.map((option) => {
                            // 'replaceAll()' changes every stored hyphen to a display space.
                            const readableOption = option.replaceAll("-", " ");

                            return (
                              <option
                                value={option}
                                key={option}
                              >
                                {readableOption}
                              </option>
                            );
                          })}
                        </select>

                        {fieldError && (
                          <small className="field__error">
                            {fieldError}
                          </small>
                        )}
                      </label>
                    );
                  }

                  let inputValue = item[key];

                  if (inputValue === null || inputValue === undefined) {
                    inputValue = "";
                  }

                  return (
                    <label
                      className="field"
                      key={key}
                    >
                      <span>{label}</span>

                      <input
                        className={inputClassName}
                        type={type}
                        required={required}
                        value={inputValue}
                        onChange={(event) => {
                          let nextValue = event.target.value;

                          if (type === "number") {
                            // 'Number()' converts the input text to a number.
                            nextValue = Number(nextValue);
                          }

                          updateItem(
                            index,
                            key,
                            nextValue,
                          );
                        }}
                      />

                      {fieldError && (
                        <small className="field__error">
                          {fieldError}
                        </small>
                      )}
                    </label>
                  );
                })}

                {section === "emergencyContacts" && (
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={Boolean(item.isPrimary)}
                      onChange={(event) => {
                        // 'Boolean()' above converts undefined to false for React.
                        updatePrimaryContact(
                          index,
                          event.target.checked,
                        );
                      }}
                    />
                    Primary emergency contact
                  </label>
                )}
              </div>
            </article>
          );
        })}
      </div>      {errors[section] && (
        <div className="alert alert--error">
          {errors[section]}
        </div>
      )}
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
  // 'useState()' stores values between renders. A function is passed for the
  // initial profile so React creates that larger object only on the first render.
  const [value, setValue] = useState(
    /**
     * Creates the form value used by the first render.
     * @param {void} _unused - React calls this initializer without arguments.
     * @returns {Record<string, unknown>} Independent form state.
     * @sideEffects None.
     */
    function buildFirstFormValue() {
      return createInitialValue(initialProfile);
    },
  );
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];

  // 'useEffect()' resets the local form whenever a different initial profile arrives.
  useEffect(() => {
    const initialValue = createInitialValue(initialProfile);
    setValue(initialValue);
  }, [initialProfile]);

  const age = calculateApproximateAge(
    value.personalInformation.dateOfBirth,
  );

  /**
   * Updates one personal-information field.
   * @param {import("react").ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>} event - Changed form field.
   * @returns {void}
   * @sideEffects Updates local form state.
   */
  function updatePersonal(event) {
    // Destructuring reads name and value from the changed HTML field.
    // The rename to fieldValue avoids confusing it with the complete form value.
    const { name, value: fieldValue } = event.target;

    // Passing a function to setValue provides the latest state. The spreads
    // copy existing fields before replacing only the changed field.
    setValue((current) => {
      return {
        ...current,
        personalInformation: {
          ...current.personalInformation,
          [name]: fieldValue,
        },
      };
    });
  }

  /**
   * Stores a selected Bangladesh district and fills its division automatically.
   * @param {import("react").ChangeEvent<HTMLSelectElement>} event - District selection event.
   * @returns {void}
   * @sideEffects Updates the district and division in local profile state.
   */
  function updateDistrict(event) {
    const district = event.target.value;
    const division = DISTRICT_TO_DIVISION[district] || value.personalInformation.division;

    setValue((current) => {
      return {
        ...current,
        personalInformation: {
          ...current.personalInformation,
          district,
          division,
        },
      };
    });
  }

  /**
   * Advances after native required-field validation.
   * @param {import("react").FormEvent<HTMLFormElement>} event - Current step submission.
   * @returns {Promise<void>}
   * @sideEffects Changes steps or invokes the supplied final API submission.
   */
  async function handleStepSubmit(event) {
    event.preventDefault();

    if (step.key === "review") {
      await onSubmit(value);
      return;
    }

    setStepIndex((current) => {
      // 'Math.min()' prevents the next index from going beyond the last step.
      return Math.min(current + 1, STEPS.length - 1);
    });
  }

  /**
   * Moves directly to a selected form step.
   * @param {number} index - Zero-based step position.
   * @returns {void}
   * @sideEffects Updates the active form step.
   */
  function selectStep(index) {
    setStepIndex(index);
  }

  /**
   * Moves to the previous form step.
   * @returns {void}
   * @sideEffects Decreases the active step index by one.
   */
  function goBack() {
    setStepIndex((current) => {
      return current - 1;
    });
  }

  /**
   * Replaces one complete repeated profile section.
   * @param {string} sectionName - Profile array property to replace.
   * @param {object[]} items - New section items.
   * @returns {void}
   * @sideEffects Updates local profile form state.
   */
  function updateSection(sectionName, items) {
    setValue((current) => {
      return {
        ...current,
        [sectionName]: items,
      };
    });
  }

  /**
   * Returns the CSS class for one step based on its progress state.
   * @param {number} index - Zero-based step position.
   * @returns {string} Active, completed, or empty step class.
   * @sideEffects None.
   */
  function getStepClassName(index) {
    if (index === stepIndex) {
      return "stepper__active";
    }

    if (index < stepIndex) {
      return "stepper__done";
    }

    return "";
  }

  const selectedDistrict = value.personalInformation.district;
  const automaticDivision = DISTRICT_TO_DIVISION[selectedDistrict];

  // 'Boolean()' converts the division text to a true/false display decision.
  const showAutomaticDivision = Boolean(automaticDivision);
  const showDivisionSelect =
    Boolean(selectedDistrict)
    && !showAutomaticDivision;

  let divisionInputClassName = "input";

  if (errors["personalInformation.division"]) {
    divisionInputClassName = "input input--error";
  }

  // 'new Date()' creates today, 'toISOString()' converts it to standard text,
  // and 'slice(0, 10)' keeps YYYY-MM-DD for the input maximum.
  const maximumDateOfBirth = new Date()
    .toISOString()
    .slice(0, 10);

  return (
    <form className="profile-form" onSubmit={handleStepSubmit}>
      <ol className="stepper" aria-label="Profile steps">
        {/* 'map()' converts every step definition into one navigation item. */}
        {STEPS.map((item, index) => (
          <li className={getStepClassName(index)} key={item.key}>
            <button
              type="button"
              onClick={() => {
                selectStep(index);
              }}
            >
              <span>{index + 1}</span>
              {item.label}
            </button>
          </li>
        ))}
      </ol>

      {step.key === "personalInformation" && (
        <section className="form-section">
          <div className="section-heading">
            <div>
              <h2>Personal information</h2>
              <p>Basic information used throughout their care record.</p>
            </div>
          </div>
          <div className="form-grid">
            <Input
              id="fullName"
              name="fullName"
              label="Full name"
              value={value.personalInformation.fullName}
              onChange={updatePersonal}
              error={errors["personalInformation.fullName"]}
              required
            />
            <Input
              id="dateOfBirth"
              name="dateOfBirth"
              type="date"
              label="Date of birth"
              max={maximumDateOfBirth}
              value={value.personalInformation.dateOfBirth}
              onChange={updatePersonal}
              error={errors["personalInformation.dateOfBirth"]}
              required
            />
            <label className="field" htmlFor="profile-gender">
              <span>Gender</span>
              <select
                id="profile-gender"
                className="input"
                name="gender"
                value={value.personalInformation.gender}
                onChange={updatePersonal}
                required
              >
                <option value="">Select gender</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="non-binary">Non-binary</option>
                <option value="prefer-not-to-say">Prefer not to say</option>
              </select>
            </label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              label="Phone number"
              value={value.personalInformation.phone}
              onChange={updatePersonal}
              error={errors["personalInformation.phone"]}
            />
            <label className="field" htmlFor="familyRelationship">
              <span>Your relationship</span>
              <select
                id="familyRelationship"
                className={errors["personalInformation.familyRelationship"] ? "input input--error" : "input"}
                name="familyRelationship"
                value={value.personalInformation.familyRelationship}
                onChange={updatePersonal}
                required
              >
                <option value="">Choose relationship</option>
                {/* 'includes()' checks whether an older saved value is in today's choices. */}
                {value.personalInformation.familyRelationship
                  && !FAMILY_RELATIONSHIPS.includes(value.personalInformation.familyRelationship) && (
                    <option value={value.personalInformation.familyRelationship}>
                      {value.personalInformation.familyRelationship}
                    </option>
                  )}
                {/* 'map()' converts every relationship string into an option. */}
                {FAMILY_RELATIONSHIPS.map((relationship) => (
                  <option
                    value={relationship}
                    key={relationship}
                  >
                    {relationship}
                  </option>
                ))}
              </select>
              {errors["personalInformation.familyRelationship"] && (
                <small className="field__error">
                  {errors["personalInformation.familyRelationship"]}
                </small>
              )}
            </label>
            <Input
              id="address"
              name="address"
              label="Home address"
              value={value.personalInformation.address}
              onChange={updatePersonal}
              error={errors["personalInformation.address"]}
              required
            />
            <label className="field" htmlFor="district">
              <span>District</span>
              <select
                id="district"
                className={errors["personalInformation.district"] ? "input input--error" : "input"}
                name="district"
                value={value.personalInformation.district}
                onChange={updateDistrict}
                required
              >
                <option value="">Choose district</option>
                {/* 'includes()' preserves an older district not present in the list. */}
                {value.personalInformation.district
                  && !BANGLADESH_DISTRICTS.includes(value.personalInformation.district) && (
                    <option value={value.personalInformation.district}>
                      {value.personalInformation.district}
                    </option>
                  )}
                {/* 'map()' converts every district string into an option. */}
                {BANGLADESH_DISTRICTS.map((district) => (
                  <option
                    value={district}
                    key={district}
                  >
                    {district}
                  </option>
                ))}
              </select>
              {errors["personalInformation.district"] && (
                <small className="field__error">
                  {errors["personalInformation.district"]}
                </small>
              )}
            </label>
            {showAutomaticDivision && (
              <div className="profile-derived-field">
                <span>Division</span>
                <strong>{value.personalInformation.division}</strong>
                <small>Filled automatically from the district.</small>
              </div>
            )}

            {showDivisionSelect && (
              <label className="field" htmlFor="division">
                <span>Division</span>

                <select
                  id="division"
                  className={divisionInputClassName}
                  name="division"
                  value={value.personalInformation.division}
                  onChange={updatePersonal}
                  required
                >
                  <option value="">Choose division</option>

                  {value.personalInformation.division
                    && !BANGLADESH_DIVISIONS.includes(
                      value.personalInformation.division,
                    ) && (
                      <option value={value.personalInformation.division}>
                        {value.personalInformation.division}
                      </option>
                    )}

                  {/* 'map()' converts every division string into an option. */}
                  {BANGLADESH_DIVISIONS.map((division) => (
                    <option
                      value={division}
                      key={division}
                    >
                      {division}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {/* 'Boolean()' converts the combined optional values to true or false. */}
          <details
            className="progressive-details"
            defaultOpen={Boolean(
              value.personalInformation.preferredName
              || value.personalInformation.careNotes
              || value.personalInformation.bloodGroup !== "unknown"
            )}
          >
            <summary>Add more personal details</summary>
            <div className="form-grid progressive-details__content">
              <Input
                id="preferredName"
                name="preferredName"
                label="Preferred name"
                value={value.personalInformation.preferredName}
                onChange={updatePersonal}
              />
              <label className="field" htmlFor="profile-blood-group">
                <span>Blood group</span>
                <select
                  id="profile-blood-group"
                  className="input"
                  name="bloodGroup"
                  value={value.personalInformation.bloodGroup}
                  onChange={updatePersonal}
                >
                  {/* 'map()' converts every blood-group string into an option. */}
                  {["unknown", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(
                    (group) => (
                      <option
                        value={group}
                        key={group}
                      >
                        {group}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label className="field" htmlFor="preferredLanguage">
                <span>Preferred language</span>
                <select
                  id="preferredLanguage"
                  className="input"
                  name="preferredLanguage"
                  value={value.personalInformation.preferredLanguage}
                  onChange={updatePersonal}
                >
                  {/* 'includes()' preserves an older saved language choice. */}
                  {value.personalInformation.preferredLanguage
                    && !PREFERRED_LANGUAGES.includes(value.personalInformation.preferredLanguage) && (
                      <option value={value.personalInformation.preferredLanguage}>
                        {value.personalInformation.preferredLanguage}
                      </option>
                    )}
                  {/* 'map()' converts every language string into an option. */}
                  {PREFERRED_LANGUAGES.map((language) => (
                    <option
                      value={language}
                      key={language}
                    >
                      {language}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field" htmlFor="careNotes">
                <span>General care notes</span>
                <textarea
                  id="careNotes"
                  className="input textarea"
                  name="careNotes"
                  value={value.personalInformation.careNotes}
                  onChange={updatePersonal}
                />
              </label>
            </div>
          </details>
        </section>
      )}
      {step.key === "health" && (
        <div className="profile-health-groups">
          <div className="profile-health-groups__intro">
            <span className="eyebrow">Add only what is known</span>
            <h2>Health information</h2>
            <p>These sections are not required to create the profile. Open only the sections you need.</p>
          </div>
          <details className="profile-health-group" defaultOpen={value.medicalHistory.length > 0}>
            <summary>Medical history <span>{value.medicalHistory.length}</span></summary>
            <RepeatedSection
              section="medicalHistory"
              title="Medical history"
              description="Past diagnoses, procedures, and significant medical events."
              items={value.medicalHistory}
              errors={errors}
              onChange={(items) => {
                updateSection("medicalHistory", items);
              }}
            />
          </details>
          <details className="profile-health-group" defaultOpen={value.allergies.length > 0}>
            <summary>Allergies <span>{value.allergies.length}</span></summary>
            <RepeatedSection
              section="allergies"
              title="Allergies"
              description="Known medicine, food, and environmental allergies."
              items={value.allergies}
              errors={errors}
              onChange={(items) => {
                updateSection("allergies", items);
              }}
            />
          </details>
          <details className="profile-health-group" defaultOpen={value.chronicDiseases.length > 0}>
            <summary>Chronic diseases <span>{value.chronicDiseases.length}</span></summary>
            <RepeatedSection
              section="chronicDiseases"
              title="Chronic diseases"
              description="Long-term conditions requiring ongoing awareness."
              items={value.chronicDiseases}
              errors={errors}
              onChange={(items) => {
                updateSection("chronicDiseases", items);
              }}
            />
          </details>
          <details className="profile-health-group" defaultOpen={value.medications.length > 0}>
            <summary>Current medications <span>{value.medications.length}</span></summary>
            <RepeatedSection
              section="medications"
              title="Current medications"
              description="Record medicines that are currently being taken."
              items={value.medications}
              errors={errors}
              onChange={(items) => {
                updateSection("medications", items);
              }}
            />
          </details>
        </div>
      )}
      {step.key === "emergencyContacts" && (
        <RepeatedSection
          section="emergencyContacts"
          title="Emergency contacts"
          description="People who should be contacted in an urgent situation."
          items={value.emergencyContacts}
          errors={errors}
          onChange={(items) => {
            updateSection("emergencyContacts", items);
          }}
        />
      )}
      {step.key === "review" && (
        <section className="form-section review-panel">
          <span className="profile-avatar">
            {value.personalInformation.preferredName?.[0]
              || value.personalInformation.fullName?.[0]
              || "P"}
          </span>

          <div>
            <span className="eyebrow">Ready to save</span>
            <h2>
              {value.personalInformation.fullName || "Unnamed profile"}
            </h2>
            <p>
              {age !== null
                ? age + " years old"
                : "Age not available"}
              {" / "}
              {value.personalInformation.district || "District not provided"}
            </p>
          </div>

          <div className="review-stats">
            <span>
              <strong>{value.medicalHistory.length}</strong>
              history entries
            </span>
            <span>
              <strong>{value.allergies.length}</strong>
              allergies
            </span>
            <span>
              <strong>{value.medications.length}</strong>
              medications
            </span>
            <span>
              <strong>{value.emergencyContacts.length}</strong>
              emergency contacts
            </span>
          </div>

          {errors.form && (
            <div className="alert alert--error">
              {errors.form}
            </div>
          )}
        </section>
      )}
      <div className="form-actions">
        {stepIndex > 0 && (
          <Button type="button" variant="secondary" onClick={goBack}>
            <ArrowLeftIcon size={18} />
            Back
          </Button>
        )}
        <Button type="submit" isLoading={isSubmitting}>
          {step.key === "review" && (
            <>
              <SaveIcon size={18} />
              {submitLabel}
            </>
          )}
          {step.key !== "review" && (
            <>
              Continue
              <ArrowRightIcon size={18} />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
