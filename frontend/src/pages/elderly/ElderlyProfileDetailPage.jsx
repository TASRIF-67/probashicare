import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppHeader } from "../../components/AppHeader.jsx";
import { Button } from "../../components/Button.jsx";
import { Card } from "../../components/Card.jsx";
import {
  ActivityIcon,
  AlertIcon,
  ArchiveIcon,
  ArrowLeftIcon,
  BloodIcon,
  CalendarIcon,
  FileTextIcon,
  HeartPulseIcon,
  LanguagesIcon,
  MapPinIcon,
  PencilIcon,
  PhoneIcon,
  PillIcon,
  StethoscopeIcon,
  UsersIcon,
  ClipboardListIcon,
} from "../../components/Icons.jsx";
import { Modal } from "../../components/Modal.jsx";
import { FamilyTaskPlanner } from "../../components/FamilyTaskPlanner.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { normalizeApiError } from "../../services/api.js";
import { elderlyProfileService } from "../../services/elderlyProfileService.js";

const PROFILE_TABS = [
  { key: "overview", label: "Overview", icon: ActivityIcon },
  { key: "medicalHistory", label: "Medical history", icon: FileTextIcon },
  { key: "allergies", label: "Allergies", icon: AlertIcon },
  { key: "medications", label: "Medications", icon: PillIcon },
  { key: "chronicDiseases", label: "Chronic diseases", icon: StethoscopeIcon },
  { key: "emergencyContacts", label: "Emergency contacts", icon: PhoneIcon },
];

/**
 * Formats an optional stored date for human-readable display.
 * @param {string|Date|null} value - Stored date.
 * @returns {string} Localized date or `Not recorded`.
 * @sideEffects None.
 */
function formatDate(value) {
  if (!value) {
    return "Not recorded";
  }

  const formatter = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  });
  return formatter.format(new Date(value));
}

/**
 * Calculates completed years from a date of birth.
 * @param {string|Date} dateOfBirth - Elderly person's birth date.
 * @returns {number} Current age in completed years.
 * @sideEffects None.
 */
function calculateAge(dateOfBirth) {
  const birth = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hasNotHadBirthday =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (hasNotHadBirthday) {
    age -= 1;
  }

  return Math.max(0, age);
}

/**
 * Converts a stored enum-style value into a readable label.
 * @param {unknown} value - Stored string-like value.
 * @returns {string} Capitalized display text or `Not recorded`.
 * @sideEffects None.
 */
function humanize(value) {
  if (!value) {
    return "Not recorded";
  }

  const text = String(value).replaceAll("-", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Renders one icon-supported personal detail.
 * @param {{icon: import("react").ComponentType, label: string, value: import("react").ReactNode}} props - Detail icon, label, and value.
 * @returns {import("react").ReactElement} Definition-list item.
 * @sideEffects None.
 */
function PersonalDetail({ icon: Icon, label, value }) {
  return (
    <div className="modern-detail">
      <span className="modern-detail__icon"><Icon size={18} /></span>
      <div><dt>{label}</dt><dd>{value || "Not recorded"}</dd></div>
    </div>
  );
}

/**
 * Renders a consistent empty state for a health-record section.
 * @param {{icon: import("react").ComponentType, title: string, description: string}} props - Empty-state presentation.
 * @returns {import("react").ReactElement} Section empty state.
 * @sideEffects None.
 */
function SectionEmpty({ icon: Icon, title, description }) {
  return (
    <div className="profile-section-empty">
      <span><Icon size={25} /></span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

/**
 * Renders medical history records.
 * @param {{items: object[]}} props - Stored medical history entries.
 * @returns {import("react").ReactElement} Modern record collection.
 * @sideEffects None.
 */
function MedicalHistorySection({ items }) {
  if (!items.length) {
    return (
      <SectionEmpty
        icon={FileTextIcon}
        title="No medical history recorded"
        description="Past diagnoses, treatments, and significant medical events will appear here."
      />
    );
  }

  return <div className="health-record-grid">{items.map((item) => <article className="health-record-card" key={item._id}><div className="health-record-card__header"><span className="record-icon"><FileTextIcon size={19} /></span><div><h3>{item.condition}</h3><span className="status-badge">{humanize(item.status)}</span></div></div><dl><div><dt>Diagnosis date</dt><dd>{formatDate(item.diagnosisDate)}</dd></div><div><dt>Hospital or doctor</dt><dd>{item.hospitalOrDoctor || "Not recorded"}</dd></div></dl>{item.treatmentSummary && <p>{item.treatmentSummary}</p>}{item.notes && <div className="record-note">{item.notes}</div>}</article>)}</div>;
}

/**
 * Renders allergy records with prominent severity labels.
 * @param {{items: object[]}} props - Stored allergy entries.
 * @returns {import("react").ReactElement} Modern allergy collection.
 * @sideEffects None.
 */
function AllergySection({ items }) {
  if (!items.length) {
    return (
      <SectionEmpty
        icon={AlertIcon}
        title="No allergies recorded"
        description="Known medicine, food, and environmental allergies will appear here."
      />
    );
  }

  return <div className="health-record-grid">{items.map((item) => <article className={`health-record-card allergy-card allergy-card--${item.severity}`} key={item._id}><div className="health-record-card__header"><span className="record-icon"><AlertIcon size={19} /></span><div><h3>{item.allergen}</h3><span className={`severity-badge severity-badge--${item.severity}`}>{humanize(item.severity)}</span></div></div><dl><div><dt>Type</dt><dd>{humanize(item.type)}</dd></div><div><dt>Reaction</dt><dd>{item.reaction || "Not recorded"}</dd></div></dl>{item.notes && <div className="record-note">{item.notes}</div>}</article>)}</div>;
}

/**
 * Renders current and past medication records.
 * @param {{items: object[]}} props - Stored medication entries.
 * @returns {import("react").ReactElement} Modern medication collection.
 * @sideEffects None.
 */
function MedicationSection({ items }) {
  if (!items.length) {
    return (
      <SectionEmpty
        icon={PillIcon}
        title="No medications recorded"
        description="Current medicine information will appear here. Scheduling and reminders are handled separately."
      />
    );
  }

  return <div className="health-record-grid">{items.map((item) => <article className="health-record-card" key={item._id}><div className="health-record-card__header"><span className="record-icon record-icon--medicine"><PillIcon size={19} /></span><div><h3>{item.name}</h3><span className={item.isActive ? "status-badge status-badge--success" : "status-badge"}>{item.isActive ? "Active" : "Inactive"}</span></div></div><dl><div><dt>Strength</dt><dd>{item.strength || "Not recorded"}</dd></div><div><dt>Dosage</dt><dd>{item.dosage || "Not recorded"}</dd></div><div><dt>Reason</dt><dd>{item.reason || "Not recorded"}</dd></div><div><dt>Prescribing doctor</dt><dd>{item.prescribingDoctor || "Not recorded"}</dd></div></dl>{item.notes && <div className="record-note">{item.notes}</div>}</article>)}</div>;
}

/**
 * Renders chronic-disease records.
 * @param {{items: object[]}} props - Stored chronic disease entries.
 * @returns {import("react").ReactElement} Modern chronic disease collection.
 * @sideEffects None.
 */
function ChronicDiseaseSection({ items }) {
  if (!items.length) {
    return (
      <SectionEmpty
        icon={StethoscopeIcon}
        title="No chronic diseases recorded"
        description="Long-term conditions requiring ongoing awareness will appear here."
      />
    );
  }

  return <div className="health-record-grid">{items.map((item) => <article className="health-record-card" key={item._id}><div className="health-record-card__header"><span className="record-icon record-icon--condition"><StethoscopeIcon size={19} /></span><div><h3>{item.name}</h3><span className="status-badge">{humanize(item.status)}</span></div></div><dl><div><dt>Diagnosis date</dt><dd>{formatDate(item.diagnosisDate)}</dd></div><div><dt>Managing doctor</dt><dd>{item.managingDoctor || "Not recorded"}</dd></div></dl>{item.notes && <div className="record-note">{item.notes}</div>}</article>)}</div>;
}

/**
 * Renders emergency contacts with the primary contact first.
 * @param {{items: object[]}} props - Stored emergency contacts.
 * @returns {import("react").ReactElement} Modern contact collection.
 * @sideEffects None.
 */
function EmergencyContactSection({ items }) {
  if (!items.length) {
    return (
      <SectionEmpty
        icon={PhoneIcon}
        title="No emergency contacts recorded"
        description="Add at least one trusted person who can be contacted urgently."
      />
    );
  }

  // The spread makes a copy so sorting does not change React state.
  const sortedItems = [...items].sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary));
  return <div className="contact-grid">{sortedItems.map((item) => <article className="contact-card" key={item._id}><span className="profile-avatar">{item.name[0]}</span><div><div className="contact-card__heading"><h3>{item.name}</h3>{item.isPrimary && <span className="status-badge status-badge--success">Primary</span>}</div><p>{item.relationship}</p><a href={`tel:${item.phone}`}><PhoneIcon size={15} /> {item.phone}</a>{item.alternativePhone && <a href={`tel:${item.alternativePhone}`}><PhoneIcon size={15} /> {item.alternativePhone}</a>}{item.address && <span><MapPinIcon size={15} /> {item.address}</span>}</div></article>)}</div>;
}

/**
 * Displays one family-authorized elderly profile in a modern sectioned layout.
 * @param {void} _unused - This page accepts no props.
 * @returns {import("react").ReactElement} Profile overview and health-record tabs.
 * @sideEffects Loads profile data and may archive it, refresh auth state, and navigate.
 */
export function ElderlyProfileDetailPage() {
  const { profileId } = useParams();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [showArchive, setShowArchive] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const { refreshUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    /**
     * Loads the profile visible to this family member.
     * @returns {Promise<void>}
     * @sideEffects Reads the profile API and updates page state.
     */
    async function loadProfile() {
      try {
        const data = await elderlyProfileService.getProfile(profileId);
        setProfile(data.profile);
      } catch (requestError) {
        const normalizedError = normalizeApiError(requestError);
        setError(normalizedError.message);
      }
    }

    loadProfile();
  }, [profileId]);

  /**
   * Opens the archive confirmation modal.
   * @returns {void}
   * @sideEffects Updates local modal state.
   */
  function openArchiveModal() {
    setShowArchive(true);
  }

  /**
   * Closes the archive confirmation modal.
   * @returns {void}
   * @sideEffects Updates local modal state.
   */
  function closeArchiveModal() {
    setShowArchive(false);
  }

  /**
   * Displays a selected profile section.
   * @param {string} tabKey - Profile tab key.
   * @returns {void}
   * @sideEffects Updates the active tab.
   */
  function selectTab(tabKey) {
    setActiveTab(tabKey);
  }

  /**
   * Archives the current profile after confirmation.
   * @param {void} _unused - This function accepts no arguments.
   * @returns {Promise<void>}
   * @sideEffects Updates MongoDB, refreshes auth, shows feedback, and navigates.
   */
  async function handleArchive() {
    setIsArchiving(true);
    try {
      await elderlyProfileService.archiveProfile(profileId);
      await refreshUser();
      showToast("Profile archived.", "success");
      navigate("/elderly-profiles", { replace: true });
    } catch (requestError) {
      setError(normalizeApiError(requestError).message);
      setShowArchive(false);
    } finally {
      setIsArchiving(false);
    }
  }

  if (error) {
    return (
      <main>
        <AppHeader />
        <div className="center-page">
          <h1>Profile unavailable</h1>
          <p>{error}</p>
          <Link className="button button--secondary" to="/elderly-profiles">
            <ArrowLeftIcon size={18} />
            Return to profiles
          </Link>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main>
        <AppHeader />
        <div className="page-loader">
          <span className="spinner" />
          Loading profile
        </div>
      </main>
    );
  }

  const personal = profile.personalInformation;
  let activeMedications = 0;
  let severeAllergies = 0;
  let primaryContact;

  for (const medication of profile.medications) {
    if (medication.isActive) {
      activeMedications += 1;
    }
  }

  for (const allergy of profile.allergies) {
    if (allergy.severity === "severe") {
      severeAllergies += 1;
    }
  }

  for (const contact of profile.emergencyContacts) {
    if (contact.isPrimary) {
      primaryContact = contact;
      break;
    }
  }

  return (
    <main>
      <AppHeader />
      <div className="modern-profile-page">
        <Link className="profile-back-link" to="/elderly-profiles"><ArrowLeftIcon size={17} /> All elderly profiles</Link>
        <section className="modern-profile-hero">
          <div className="modern-profile-identity">
            <span className="profile-avatar profile-avatar--xl">{personal.preferredName?.[0] || personal.fullName[0]}</span>
            <div>
              <div className="identity-labels"><span className="status-badge status-badge--success">Active profile</span><span>{profile.familyAccess.relationship}</span></div>
              <h1>{personal.fullName}</h1>
              <p>{personal.preferredName ? `Known as ${personal.preferredName}` : "No preferred name recorded"} · {calculateAge(personal.dateOfBirth)} years old</p>
            </div>
          </div>
          <div className="modern-profile-actions">
            <Link className="button button--secondary" to={`/elderly-profiles/${profileId}/wellness`}><ClipboardListIcon size={17} /> Wellness &amp; vitals</Link>
            <Link className="button button--primary" to={`/elderly-profiles/${profileId}/edit`}><PencilIcon size={17} /> Edit profile</Link>
            {profile.familyAccess.permission === "owner" && (
              <Button variant="ghost" onClick={openArchiveModal}>
                <ArchiveIcon size={17} />
                Archive
              </Button>
            )}
          </div>
        </section>

        {severeAllergies > 0 && (
          <div className="profile-alert" role="status">
            <span>
              <AlertIcon />
            </span>
            <div>
              <strong>Severe allergy alert</strong>
              <p>
                {severeAllergies} severe allerg
                {severeAllergies === 1 ? "y is" : "ies are"} recorded. Review
                allergy details before coordinating care.
              </p>
            </div>
            <button type="button" onClick={() => selectTab("allergies")}>
              Review allergies
            </button>
          </div>
        )}

        <section className="health-snapshot" aria-label="Health summary">
          <Card className="snapshot-card"><span className="snapshot-card__icon snapshot-card__icon--condition"><HeartPulseIcon /></span><div><strong>{profile.chronicDiseases.length}</strong><span>Chronic conditions</span><small>{profile.chronicDiseases.length ? "Recorded health conditions" : "None recorded"}</small></div></Card>
          <Card className="snapshot-card"><span className="snapshot-card__icon snapshot-card__icon--medicine"><PillIcon /></span><div><strong>{activeMedications}</strong><span>Active medications</span><small>{profile.medications.length - activeMedications} inactive</small></div></Card>
          <Card className="snapshot-card"><span className="snapshot-card__icon snapshot-card__icon--allergy"><AlertIcon /></span><div><strong>{profile.allergies.length}</strong><span>Known allergies</span><small>{severeAllergies} severe</small></div></Card>
          <Card className="snapshot-card"><span className="snapshot-card__icon"><PhoneIcon /></span><div><strong>{profile.emergencyContacts.length}</strong><span>Emergency contacts</span><small>{primaryContact ? `${primaryContact.name} is primary` : "No primary selected"}</small></div></Card>
        </section>

        <section className="modern-section-card" style={{ marginTop: "1.5rem" }}>
          <FamilyTaskPlanner elderlyProfileId={profileId} elderlyName={personal.preferredName || personal.fullName} />
        </section>

        <nav className="profile-tabs" aria-label="Profile sections">
          {PROFILE_TABS.map(({ key, label, icon: Icon }) => <button className={activeTab === key ? "profile-tab profile-tab--active" : "profile-tab"} type="button" aria-current={activeTab === key ? "page" : undefined} onClick={() => setActiveTab(key)} key={key}><Icon size={17} /> {label}<span>{key === "overview" ? "" : profile[key].length}</span></button>)}
        </nav>

        <section className="profile-tab-content">
          {activeTab === "overview" && (
            <div className="profile-overview-grid">
              <Card className="modern-section-card">
                <div className="modern-section-card__heading"><div><span className="section-icon"><UsersIcon size={19} /></span><div><h2>Personal information</h2><p>Identity and contact details</p></div></div></div>
                <dl className="modern-details-grid">
                  <PersonalDetail icon={CalendarIcon} label="Date of birth" value={formatDate(personal.dateOfBirth)} />
                  <PersonalDetail icon={UsersIcon} label="Gender" value={humanize(personal.gender)} />
                  <PersonalDetail icon={BloodIcon} label="Blood group" value={personal.bloodGroup} />
                  <PersonalDetail icon={PhoneIcon} label="Phone" value={personal.phone} />
                  <PersonalDetail icon={LanguagesIcon} label="Preferred language" value={personal.preferredLanguage} />
                  <PersonalDetail icon={MapPinIcon} label="Location" value={`${personal.address}, ${personal.district}, ${personal.division}`} />
                </dl>
              </Card>
              <Card className="modern-section-card care-notes-card">
                <div className="modern-section-card__heading"><div><span className="section-icon"><FileTextIcon size={19} /></span><div><h2>Care notes</h2><p>Important context for coordinating care</p></div></div></div>
                {personal.careNotes ? <p>{personal.careNotes}</p> : <SectionEmpty icon={FileTextIcon} title="No care notes" description="General preferences and care context can be added while editing the profile." />}
              </Card>
              <Card className="modern-section-card overview-contact-card">
                <div className="modern-section-card__heading">
                  <div>
                    <span className="section-icon">
                      <PhoneIcon size={19} />
                    </span>
                    <div>
                      <h2>Primary emergency contact</h2>
                      <p>First person to contact urgently</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => selectTab("emergencyContacts")}
                  >
                    View all
                  </button>
                </div>
                {primaryContact ? <div className="primary-contact"><span className="profile-avatar">{primaryContact.name[0]}</span><div><strong>{primaryContact.name}</strong><span>{primaryContact.relationship}</span><a href={`tel:${primaryContact.phone}`}><PhoneIcon size={15} /> {primaryContact.phone}</a></div></div> : <SectionEmpty icon={PhoneIcon} title="No primary contact" description="Choose a primary emergency contact from the contact section." />}
              </Card>
            </div>
          )}
          {activeTab === "medicalHistory" && <MedicalHistorySection items={profile.medicalHistory} />}
          {activeTab === "allergies" && <AllergySection items={profile.allergies} />}
          {activeTab === "medications" && <MedicationSection items={profile.medications} />}
          {activeTab === "chronicDiseases" && <ChronicDiseaseSection items={profile.chronicDiseases} />}
          {activeTab === "emergencyContacts" && <EmergencyContactSection items={profile.emergencyContacts} />}
        </section>
      </div>
      <Modal
        isOpen={showArchive}
        title="Archive this profile?"
        onClose={closeArchiveModal}
      >
        <p>The health record will be preserved but removed from active profiles. This action is currently not reversible from the interface.</p>
        <div className="modal-actions">
          <Button variant="secondary" onClick={closeArchiveModal}>
            Cancel
          </Button>
          <Button isLoading={isArchiving} onClick={handleArchive}>
            <ArchiveIcon size={17} />
            Archive profile
          </Button>
        </div>
      </Modal>
    </main>
  );
}
