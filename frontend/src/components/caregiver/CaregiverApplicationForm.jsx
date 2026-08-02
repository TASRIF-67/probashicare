import { useEffect, useState } from "react";
import { Button } from "../Button.jsx";
import { Input } from "../Input.jsx";
import { CloseIcon, FileCheckIcon, PlusIcon, SaveIcon, UploadIcon } from "../Icons.jsx";

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
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
 * Converts an API application into editable form values.
 * @param {Record<string, unknown>|null} application - Existing caregiver application.
 * @returns {Record<string, unknown>} Form-safe application fields.
 * @sideEffects None.
 */
function toFormValue(application) {
  if (!application) return structuredClone(EMPTY_APPLICATION);
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
 * @returns {{skills: string, languages: string}} Text that preserves in-progress separators while typing.
 * @sideEffects None.
 */
function toTagText(application) {
  return {
    skills: (application?.skills || []).join(", "),
    languages: (application?.languages || []).join(", "),
  };
}

/**
 * Renders the caregiver application and approved-profile editor.
 * @param {{application: object, errors?: object, isBusy?: boolean, approvedMode?: boolean, onSaveDraft?: Function, onSubmitApplication?: Function, onUpdateApproved?: Function}} props - Application data and actions.
 * @returns {import("react").ReactElement} Single-page caregiver form.
 * @sideEffects Manages form/file state and invokes supplied async actions.
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
  const [value, setValue] = useState(() => toFormValue(application));
  const [tagText, setTagText] = useState(() => toTagText(application));
  const [documentFile, setDocumentFile] = useState(null);

  useEffect(() => {
    setValue(toFormValue(application));
    setTagText(toTagText(application));
    setDocumentFile(null);
  }, [application]);

  /**
   * Updates a scalar application field.
   * @param {import("react").ChangeEvent<HTMLInputElement|HTMLTextAreaElement>} event - Changed field event.
   * @returns {void}
   * @sideEffects Updates component form state.
   */
  function handleChange(event) {
    setValue((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  /**
   * Converts a comma-separated tag field into a normalized string array.
   * @param {"skills"|"languages"} field - Array field to update.
   * @param {string} text - Comma-separated user input.
   * @returns {void}
   * @sideEffects Updates component form state.
   */
  function handleTags(field, text) {
    setTagText((current) => ({ ...current, [field]: text }));
    setValue((current) => ({ ...current, [field]: text.split(",").map((item) => item.trim()).filter(Boolean) }));
  }

  /**
   * Updates one availability field.
   * @param {number} index - Availability entry position.
   * @param {string} field - Entry field name.
   * @param {string} nextValue - New value.
   * @returns {void}
   * @sideEffects Updates component form state.
   */
  function updateAvailability(index, field, nextValue) {
    setValue((current) => ({
      ...current,
      availability: current.availability.map((entry, entryIndex) => entryIndex === index ? { ...entry, [field]: nextValue } : entry),
    }));
  }

  /**
   * Prevents native navigation and invokes the relevant final action.
   * @param {import("react").FormEvent<HTMLFormElement>} event - Form submission event.
   * @returns {Promise<void>}
   * @sideEffects Calls the approved update or application submission action.
   */
  async function handleSubmit(event) {
    event.preventDefault();
    if (approvedMode) await onUpdateApproved(value);
    else await onSubmitApplication(value, documentFile);
  }

  return (
    <form className="caregiver-application-form" onSubmit={handleSubmit}>
      <section className="application-section"><div className="application-section__heading"><span>01</span><div><h2>Professional profile</h2><p>Tell families about your experience and the care you provide.</p></div></div><div className="form-grid"><Input id="caregiver-phone" name="phone" type="tel" label="Phone number" value={value.phone} onChange={handleChange} error={errors.phone} required /><Input id="caregiver-experience" name="yearsOfExperience" type="number" min="0" max="60" label="Years of experience" value={value.yearsOfExperience} onChange={handleChange} error={errors.yearsOfExperience} required /><label className="field field--wide"><span>Short bio</span><textarea className={errors.bio ? "input textarea input--error" : "input textarea"} name="bio" value={value.bio} onChange={handleChange} placeholder="Describe your caregiving background and approach" required />{errors.bio && <small className="field__error">{errors.bio}</small>}</label><Input id="caregiver-skills" label="Skills" value={tagText.skills} onChange={(event) => handleTags("skills", event.target.value)} error={errors.skills} hint="Separate each skill with a comma." placeholder="Elderly care, medication support, mobility" required /><Input id="caregiver-languages" label="Languages spoken" value={tagText.languages} onChange={(event) => handleTags("languages", event.target.value)} error={errors.languages} hint="Separate each language with a comma." placeholder="Bangla, English" required /></div></section>
      <section className="application-section"><div className="application-section__heading"><span>02</span><div><h2>Rates and service area</h2><p>Set clear rates in BDT and describe where you can work.</p></div></div><div className="form-grid"><Input id="hourly-rate" name="hourlyRate" type="number" min="0" label="Hourly rate (BDT)" value={value.hourlyRate} onChange={handleChange} error={errors.hourlyRate} required /><Input id="monthly-rate" name="monthlyRate" type="number" min="0" label="Monthly rate (BDT)" value={value.monthlyRate} onChange={handleChange} error={errors.monthlyRate} required /><Input id="service-area" name="serviceArea" label="Service area" value={value.serviceArea} onChange={handleChange} error={errors.serviceArea} placeholder="For example, Dhanmondi and nearby areas" required /></div></section>
      <section className="application-section"><div className="application-section__heading application-section__heading--action"><div className="application-section__heading-main"><span>03</span><div><h2>Availability</h2><p>Add the days and time periods you are normally available.</p></div></div><Button type="button" variant="secondary" onClick={() => setValue((current) => ({ ...current, availability: [...current.availability, { day: "monday", startTime: "09:00", endTime: "17:00" }] }))}><PlusIcon size={17} /> Add period</Button></div>{!value.availability.length && <div className="empty-state">No availability periods added.</div>}<div className="availability-list">{value.availability.map((entry, index) => <div className="availability-row" key={entry._id || index}><label className="field"><span>Day</span><select className="input" value={entry.day} onChange={(event) => updateAvailability(index, "day", event.target.value)}>{WEEKDAYS.map((day) => <option value={day} key={day}>{day.charAt(0).toUpperCase() + day.slice(1)}</option>)}</select></label><Input id={`start-${index}`} type="time" label="Start" value={entry.startTime} onChange={(event) => updateAvailability(index, "startTime", event.target.value)} error={errors[`availability.${index}.startTime`]} /><Input id={`end-${index}`} type="time" label="End" value={entry.endTime} onChange={(event) => updateAvailability(index, "endTime", event.target.value)} error={errors[`availability.${index}.endTime`]} /><button className="icon-button" type="button" aria-label={`Remove availability period ${index + 1}`} onClick={() => setValue((current) => ({ ...current, availability: current.availability.filter((_, entryIndex) => entryIndex !== index) }))}><CloseIcon size={17} /></button></div>)}</div>{errors.availability && <div className="alert alert--error">{errors.availability}</div>}</section>
      {!approvedMode && <section className="application-section"><div className="application-section__heading"><span>04</span><div><h2>Verification document {application.isVerificationDocumentRequired ? "" : "(optional for now)"}</h2><p>{application.isVerificationDocumentRequired ? "Upload one ID or verification document. PDF, JPG, or PNG up to 5 MB." : "You can submit without a document while Cloudinary integration is deferred."}</p></div></div><label className="document-drop"><UploadIcon size={26} /><strong>{documentFile ? documentFile.name : "Choose verification document"}</strong><span>{application.verificationDocument?.originalName ? `Current: ${application.verificationDocument.originalName}` : "No document uploaded yet"}</span><input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => setDocumentFile(event.target.files?.[0] || null)} /></label>{application.verificationDocument?.publicId && <div className="document-ready"><FileCheckIcon size={18} /> Verification document uploaded</div>}{errors.verificationDocument && <div className="alert alert--error">{errors.verificationDocument}</div>}</section>}
      {errors.form && <div className="alert alert--error">{errors.form}</div>}
      <div className="application-actions">{!approvedMode && <Button type="button" variant="secondary" isLoading={isBusy} onClick={() => onSaveDraft(value, documentFile)}><SaveIcon size={18} /> Save as draft</Button>}<Button type="submit" isLoading={isBusy}>{approvedMode ? <><SaveIcon size={18} /> Save profile</> : <><FileCheckIcon size={18} /> {application.applicationStatus === "rejected" ? "Resubmit" : "Submit for review"}</>}</Button></div>
    </form>
  );
}
