import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppHeader } from "../../components/AppHeader.jsx";
import { BridgeLoader } from "../../components/BridgeLoader.jsx";
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
} from "../../components/Icons.jsx";
import { Modal } from "../../components/Modal.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { normalizeApiError } from "../../services/api.js";
import { elderlyProfileService } from "../../services/elderlyProfileService.js";

const PROFILE_TABS = [
  {
    key: "overview",
    label: "Overview",
    icon: ActivityIcon,
  },
  {
    key: "medicalHistory",
    label: "Medical history",
    icon: FileTextIcon,
  },
  {
    key: "allergies",
    label: "Allergies",
    icon: AlertIcon,
  },
  {
    key: "medications",
    label: "Medications",
    icon: PillIcon,
  },
  {
    key: "chronicDiseases",
    label: "Chronic diseases",
    icon: StethoscopeIcon,
  },
  {
    key: "emergencyContacts",
    label: "Emergency contacts",
    icon: PhoneIcon,
  },
];

/**
 * Formats an optional stored date for human-readable display.
 * @param {string|Date|null} value - Stored date.
 * @returns {string} Localized date or Not recorded.
 * @sideEffects None.
 */
function formatDate(value) {
  if (!value) {
    return "Not recorded";
  }

  // 'Intl.DateTimeFormat' is a built-in formatter for localized date text.
  const formatter = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  });

  // 'new Date()' converts the stored value into a Date object.
  const date = new Date(value);

  // 'format()' returns the readable text produced by the formatter.
  return formatter.format(date);
}

/**
 * Calculates completed years from a date of birth.
 * @param {string|Date} dateOfBirth - Elderly person's birth date.
 * @returns {number} Current age in completed years.
 * @sideEffects Reads the current date.
 */
function calculateAge(dateOfBirth) {
  // Each 'new Date()' call creates a JavaScript Date object.
  const birth = new Date(dateOfBirth);
  const today = new Date();

  // The Date getter functions return numeric year, month, and day parts.
  let age = today.getFullYear() - birth.getFullYear();

  const currentMonthIsEarlier =
    today.getMonth() < birth.getMonth();
  const sameMonthButEarlierDay =
    today.getMonth() === birth.getMonth()
    && today.getDate() < birth.getDate();

  const hasNotHadBirthday =
    currentMonthIsEarlier || sameMonthButEarlierDay;

  if (hasNotHadBirthday) {
    age -= 1;
  }

  // 'Math.max()' prevents a negative displayed age.
  return Math.max(0, age);
}

/**
 * Converts a stored enum-style value into a readable label.
 * @param {unknown} value - Stored string-like value.
 * @returns {string} Capitalized display text or Not recorded.
 * @sideEffects None.
 */
function humanize(value) {
  if (!value) {
    return "Not recorded";
  }

  // 'String()' safely converts the supplied value to text.
  // 'replaceAll()' changes every hyphen into a space.
  const text = String(value).replaceAll("-", " ");

  // 'charAt(0)' reads the first character. 'toUpperCase()' capitalizes it.
  // 'slice(1)' returns the remainder of the text from index one onward.
  const firstCharacter = text.charAt(0).toUpperCase();
  const remainingCharacters = text.slice(1);

  return firstCharacter + remainingCharacters;
}

/**
 * Renders one icon-supported personal detail.
 * @param {object} props - Detail presentation.
 * @param {import("react").ComponentType} props.icon - Detail icon.
 * @param {string} props.label - Field label.
 * @param {import("react").ReactNode} props.value - Displayed field value.
 * @returns {import("react").ReactElement} Definition-list item.
 * @sideEffects None.
 */
function PersonalDetail({ icon: Icon, label, value }) {
  const displayedValue = value || "Not recorded";

  return (
    <div className="modern-detail">
      <span className="modern-detail__icon">
        <Icon size={18} />
      </span>

      <div>
        <dt>{label}</dt>
        <dd>{displayedValue}</dd>
      </div>
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
      <span>
        <Icon size={25} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

/**
 * Renders one medical-history entry.
 * @param {{item: object}} props - One stored medical-history entry.
 * @returns {import("react").ReactElement} Medical-history card.
 * @sideEffects None.
 */
function MedicalHistoryCard({ item }) {
  return (
    <article className="health-record-card">
      <div className="health-record-card__header">
        <span className="record-icon">
          <FileTextIcon size={19} />
        </span>

        <div>
          <h3>{item.condition}</h3>
          <span className="status-badge">
            {humanize(item.status)}
          </span>
        </div>
      </div>

      <dl>
        <div>
          <dt>Diagnosis date</dt>
          <dd>{formatDate(item.diagnosisDate)}</dd>
        </div>
        <div>
          <dt>Hospital or doctor</dt>
          <dd>{item.hospitalOrDoctor || "Not recorded"}</dd>
        </div>
      </dl>

      {item.treatmentSummary && (
        <p>{item.treatmentSummary}</p>
      )}

      {item.notes && (
        <div className="record-note">
          {item.notes}
        </div>
      )}
    </article>
  );
}

/**
 * Renders medical history records.
 * @param {{items: object[]}} props - Stored medical history entries.
 * @returns {import("react").ReactElement} Medical-history collection.
 * @sideEffects None.
 */
function MedicalHistorySection({ items }) {
  if (items.length === 0) {
    return (
      <SectionEmpty
        icon={FileTextIcon}
        title="No medical history recorded"
        description="Past diagnoses, treatments, and significant medical events will appear here."
      />
    );
  }

  return (
    <div className="health-record-grid">
      {/* 'map()' converts every history object into a React card. */}
      {items.map((item) => (
        <MedicalHistoryCard
          key={item._id}
          item={item}
        />
      ))}
    </div>
  );
}

/**
 * Renders one allergy entry.
 * @param {{item: object}} props - One stored allergy.
 * @returns {import("react").ReactElement} Allergy card.
 * @sideEffects None.
 */
function AllergyCard({ item }) {
  const cardClassName =
    "health-record-card allergy-card allergy-card--"
    + item.severity;
  const severityClassName =
    "severity-badge severity-badge--"
    + item.severity;

  return (
    <article className={cardClassName}>
      <div className="health-record-card__header">
        <span className="record-icon">
          <AlertIcon size={19} />
        </span>

        <div>
          <h3>{item.allergen}</h3>
          <span className={severityClassName}>
            {humanize(item.severity)}
          </span>
        </div>
      </div>

      <dl>
        <div>
          <dt>Type</dt>
          <dd>{humanize(item.type)}</dd>
        </div>
        <div>
          <dt>Reaction</dt>
          <dd>{item.reaction || "Not recorded"}</dd>
        </div>
      </dl>

      {item.notes && (
        <div className="record-note">
          {item.notes}
        </div>
      )}
    </article>
  );
}

/**
 * Renders allergy records with prominent severity labels.
 * @param {{items: object[]}} props - Stored allergy entries.
 * @returns {import("react").ReactElement} Allergy collection.
 * @sideEffects None.
 */
function AllergySection({ items }) {
  if (items.length === 0) {
    return (
      <SectionEmpty
        icon={AlertIcon}
        title="No allergies recorded"
        description="Known medicine, food, and environmental allergies will appear here."
      />
    );
  }

  return (
    <div className="health-record-grid">
      {/* 'map()' converts every allergy object into a React card. */}
      {items.map((item) => (
        <AllergyCard
          key={item._id}
          item={item}
        />
      ))}
    </div>
  );
}

/**
 * Renders one medication entry.
 * @param {{item: object}} props - One stored medication.
 * @returns {import("react").ReactElement} Medication card.
 * @sideEffects None.
 */
function MedicationCard({ item }) {
  let statusClassName = "status-badge";
  let statusText = "Inactive";

  if (item.isActive) {
    statusClassName = "status-badge status-badge--success";
    statusText = "Active";
  }

  return (
    <article className="health-record-card">
      <div className="health-record-card__header">
        <span className="record-icon record-icon--medicine">
          <PillIcon size={19} />
        </span>

        <div>
          <h3>{item.name}</h3>
          <span className={statusClassName}>
            {statusText}
          </span>
        </div>
      </div>

      <dl>
        <div>
          <dt>Strength</dt>
          <dd>{item.strength || "Not recorded"}</dd>
        </div>
        <div>
          <dt>Dosage</dt>
          <dd>{item.dosage || "Not recorded"}</dd>
        </div>
        <div>
          <dt>Reason</dt>
          <dd>{item.reason || "Not recorded"}</dd>
        </div>
        <div>
          <dt>Prescribing doctor</dt>
          <dd>{item.prescribingDoctor || "Not recorded"}</dd>
        </div>
      </dl>

      {item.notes && (
        <div className="record-note">
          {item.notes}
        </div>
      )}
    </article>
  );
}

/**
 * Renders current and past medication records.
 * @param {{items: object[]}} props - Stored medication entries.
 * @returns {import("react").ReactElement} Medication collection.
 * @sideEffects None.
 */
function MedicationSection({ items }) {
  if (items.length === 0) {
    return (
      <SectionEmpty
        icon={PillIcon}
        title="No medications recorded"
        description="Current medicine information will appear here. Scheduling and reminders are handled separately."
      />
    );
  }

  return (
    <div className="health-record-grid">
      {/* 'map()' converts every medication object into a React card. */}
      {items.map((item) => (
        <MedicationCard
          key={item._id}
          item={item}
        />
      ))}
    </div>
  );
}

/**
 * Renders one chronic-disease entry.
 * @param {{item: object}} props - One stored chronic disease.
 * @returns {import("react").ReactElement} Chronic-disease card.
 * @sideEffects None.
 */
function ChronicDiseaseCard({ item }) {
  return (
    <article className="health-record-card">
      <div className="health-record-card__header">
        <span className="record-icon record-icon--condition">
          <StethoscopeIcon size={19} />
        </span>

        <div>
          <h3>{item.name}</h3>
          <span className="status-badge">
            {humanize(item.status)}
          </span>
        </div>
      </div>

      <dl>
        <div>
          <dt>Diagnosis date</dt>
          <dd>{formatDate(item.diagnosisDate)}</dd>
        </div>
        <div>
          <dt>Managing doctor</dt>
          <dd>{item.managingDoctor || "Not recorded"}</dd>
        </div>
      </dl>

      {item.notes && (
        <div className="record-note">
          {item.notes}
        </div>
      )}
    </article>
  );
}

/**
 * Renders chronic-disease records.
 * @param {{items: object[]}} props - Stored chronic disease entries.
 * @returns {import("react").ReactElement} Chronic-disease collection.
 * @sideEffects None.
 */
function ChronicDiseaseSection({ items }) {
  if (items.length === 0) {
    return (
      <SectionEmpty
        icon={StethoscopeIcon}
        title="No chronic diseases recorded"
        description="Long-term conditions requiring ongoing awareness will appear here."
      />
    );
  }

  return (
    <div className="health-record-grid">
      {/* 'map()' converts every disease object into a React card. */}
      {items.map((item) => (
        <ChronicDiseaseCard
          key={item._id}
          item={item}
        />
      ))}
    </div>
  );
}

/**
 * Places primary emergency contacts before other contacts.
 * @param {object} left - First contact being compared.
 * @param {object} right - Second contact being compared.
 * @returns {number} Negative, zero, or positive sort order.
 * @sideEffects None.
 */
function comparePrimaryContacts(left, right) {
  // 'Number()' converts true to 1 and false to 0.
  const leftPrimaryNumber = Number(left.isPrimary);
  const rightPrimaryNumber = Number(right.isPrimary);

  return rightPrimaryNumber - leftPrimaryNumber;
}

/**
 * Renders one emergency contact.
 * @param {{item: object}} props - One stored emergency contact.
 * @returns {import("react").ReactElement} Emergency-contact card.
 * @sideEffects None.
 */
function EmergencyContactCard({ item }) {
  const phoneLink = "tel:" + item.phone;
  const alternativePhoneLink = "tel:" + item.alternativePhone;

  return (
    <article className="contact-card">
      <span className="profile-avatar">
        {item.name[0]}
      </span>

      <div>
        <div className="contact-card__heading">
          <h3>{item.name}</h3>

          {item.isPrimary && (
            <span className="status-badge status-badge--success">
              Primary
            </span>
          )}
        </div>

        <p>{item.relationship}</p>

        <a href={phoneLink}>
          <PhoneIcon size={15} />
          {item.phone}
        </a>

        {item.alternativePhone && (
          <a href={alternativePhoneLink}>
            <PhoneIcon size={15} />
            {item.alternativePhone}
          </a>
        )}

        {item.address && (
          <span>
            <MapPinIcon size={15} />
            {item.address}
          </span>
        )}
      </div>
    </article>
  );
}

/**
 * Renders emergency contacts with the primary contact first.
 * @param {{items: object[]}} props - Stored emergency contacts.
 * @returns {import("react").ReactElement} Emergency-contact collection.
 * @sideEffects None.
 */
function EmergencyContactSection({ items }) {
  if (items.length === 0) {
    return (
      <SectionEmpty
        icon={PhoneIcon}
        title="No emergency contacts recorded"
        description="Add at least one trusted person who can be contacted urgently."
      />
    );
  }

  const sortedItems = [];

  // Copying with 'push()' prevents sort() from changing the React state array.
  for (const item of items) {
    sortedItems.push(item);
  }

  // 'sort()' reorders this copied array using the comparison function.
  sortedItems.sort(comparePrimaryContacts);

  return (
    <div className="contact-grid">
      {/* 'map()' converts every contact object into a React card. */}
      {sortedItems.map((item) => (
        <EmergencyContactCard
          key={item._id}
          item={item}
        />
      ))}
    </div>
  );
}

/**
 * Displays one family-authorized elderly profile in a sectioned layout.
 * @param {void} _unused - This page accepts no props.
 * @returns {import("react").ReactElement} Profile overview and health-record tabs.
 * @sideEffects Loads profile data and may archive it, refresh auth state, and navigate.
 */
export function ElderlyProfileDetailPage() {
  // 'useParams()' reads profileId from the dynamic URL segment.
  const { profileId } = useParams();

  // Every 'useState()' call stores one value between React renders.
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [showArchive, setShowArchive] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const { refreshUser } = useAuth();
  const { showToast } = useToast();

  // 'useNavigate()' returns a function for changing routes in JavaScript.
  const navigate = useNavigate();

  // 'useEffect()' runs after render and again if profileId changes.
  useEffect(() => {
    /**
     * Loads the profile visible to this family member.
     * @param {void} _unused - This function accepts no arguments.
     * @returns {Promise<void>} Resolves after profile or error state is updated.
     * @sideEffects Reads the profile API and updates page state.
     */
    async function loadProfile() {
      // Execution sequence:
      // 1. Load the authorized profile selected by the URL.
      // 2. Store either profile data or a normalized error.
      // 3. End page loading after success or failure.
      try {
        // 'await' pauses until the service Promise resolves or rejects.
        const data = await elderlyProfileService.getProfile(profileId);
        setProfile(data.profile);
      } catch (requestError) {
        const normalizedError = normalizeApiError(requestError);
        setError(normalizedError.message);
      }
    }

    // Calling the async function starts it. The effect itself returns no Promise.
    loadProfile();
  }, [profileId]);

  /**
   * Opens the archive confirmation modal.
   * @param {void} _unused - This function accepts no arguments.
   * @returns {void}
   * @sideEffects Updates local modal state.
   */
  function openArchiveModal() {
    setShowArchive(true);
  }

  /**
   * Closes the archive confirmation modal.
   * @param {void} _unused - This function accepts no arguments.
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
   * @returns {Promise<void>} Resolves after archive handling finishes.
   * @sideEffects Updates MongoDB, refreshes auth, shows feedback, and navigates.
   */
  async function handleArchive() {
    // Execution sequence:
    // 1. Lock the confirmation action while the request runs.
    // 2. Soft-archive through the API and refresh shared user state.
    // 3. Navigate on success or show an error, then unlock the action.
    setIsArchiving(true);

    try {
      await elderlyProfileService.archiveProfile(profileId);
      await refreshUser();

      showToast("Profile archived.", "success");
      navigate("/elderly-profiles", {
        replace: true,
      });
    } catch (requestError) {
      const normalizedError = normalizeApiError(requestError);

      setError(normalizedError.message);
      setShowArchive(false);
    } finally {
      // 'finally' runs after success or failure, restoring the archive button.
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

          <Link
            className="button button--secondary"
            to="/elderly-profiles"
          >
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

        <div className="page-loader page-loader--bridge">
          <BridgeLoader label="Opening care profile" />
        </div>
      </main>
    );
  }

  const personal = profile.personalInformation;
  let activeMedications = 0;
  let severeAllergies = 0;
  let primaryContact = null;

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

  let profileInitial = personal.fullName[0];

  if (personal.preferredName) {
    profileInitial = personal.preferredName[0];
  }

  let preferredNameText = "No preferred name recorded";

  if (personal.preferredName) {
    preferredNameText = "Known as " + personal.preferredName;
  }

  let allergyGrammar = "ies are";

  if (severeAllergies === 1) {
    allergyGrammar = "y is";
  }

  let chronicConditionText = "None recorded";

  if (profile.chronicDiseases.length > 0) {
    chronicConditionText = "Recorded health conditions";
  }

  let primaryContactText = "No primary selected";

  if (primaryContact) {
    primaryContactText = primaryContact.name + " is primary";
  }

  const editPath = "/elderly-profiles/" + profileId + "/edit";
  const locationText =
    personal.address
    + ", "
    + personal.district
    + ", "
    + personal.division;

  return (
    <main>
      <AppHeader />

      <div className="modern-profile-page">
        <Link
          className="profile-back-link"
          to="/elderly-profiles"
        >
          <ArrowLeftIcon size={17} />
          All elderly profiles
        </Link>

        <section className="modern-profile-hero">
          <div className="modern-profile-identity">
            <span className="profile-avatar profile-avatar--xl">
              {profileInitial}
            </span>

            <div>
              <div className="identity-labels">
                <span className="status-badge status-badge--success">
                  Active profile
                </span>
                <span>{profile.familyAccess.relationship}</span>
              </div>

              <h1>{personal.fullName}</h1>

              <p>
                {preferredNameText}
                {" · "}
                {calculateAge(personal.dateOfBirth)}
                {" years old"}
              </p>
            </div>
          </div>

          <div className="modern-profile-actions">
            <Link
              className="button button--primary"
              to={editPath}
            >
              <PencilIcon size={17} />
              Edit profile
            </Link>

            {profile.familyAccess.permission === "owner" && (
              <Button
                variant="ghost"
                onClick={openArchiveModal}
              >
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
                {severeAllergies}
                {" severe allerg"}
                {allergyGrammar}
                {" recorded. Review allergy details before coordinating care."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                selectTab("allergies");
              }}
            >
              Review allergies
            </button>
          </div>
        )}

        <section
          className="health-snapshot"
          aria-label="Health summary"
        >
          <Card className="snapshot-card">
            <span className="snapshot-card__icon snapshot-card__icon--condition">
              <HeartPulseIcon />
            </span>
            <div>
              <strong>{profile.chronicDiseases.length}</strong>
              <span>Chronic conditions</span>
              <small>{chronicConditionText}</small>
            </div>
          </Card>

          <Card className="snapshot-card">
            <span className="snapshot-card__icon snapshot-card__icon--medicine">
              <PillIcon />
            </span>
            <div>
              <strong>{activeMedications}</strong>
              <span>Active medications</span>
              <small>
                {profile.medications.length - activeMedications}
                {" inactive"}
              </small>
            </div>
          </Card>

          <Card className="snapshot-card">
            <span className="snapshot-card__icon snapshot-card__icon--allergy">
              <AlertIcon />
            </span>
            <div>
              <strong>{profile.allergies.length}</strong>
              <span>Known allergies</span>
              <small>
                {severeAllergies}
                {" severe"}
              </small>
            </div>
          </Card>

          <Card className="snapshot-card">
            <span className="snapshot-card__icon">
              <PhoneIcon />
            </span>
            <div>
              <strong>{profile.emergencyContacts.length}</strong>
              <span>Emergency contacts</span>
              <small>{primaryContactText}</small>
            </div>
          </Card>
        </section>

        <nav
          className="profile-tabs"
          aria-label="Profile sections"
        >
          {/* 'map()' converts every tab definition into one React button. */}
          {PROFILE_TABS.map((tab) => {
            const Icon = tab.icon;
            let tabClassName = "profile-tab";
            let ariaCurrent;
            let itemCount = "";

            if (activeTab === tab.key) {
              tabClassName = "profile-tab profile-tab--active";
              ariaCurrent = "page";
            }

            if (tab.key !== "overview") {
              itemCount = profile[tab.key].length;
            }

            return (
              <button
                className={tabClassName}
                type="button"
                aria-current={ariaCurrent}
                onClick={() => {
                  selectTab(tab.key);
                }}
                key={tab.key}
              >
                <Icon size={17} />
                {tab.label}
                <span>{itemCount}</span>
              </button>
            );
          })}
        </nav>

        <section className="profile-tab-content">
          {activeTab === "overview" && (
            <div className="profile-overview-grid">
              <Card className="modern-section-card">
                <div className="modern-section-card__heading">
                  <div>
                    <span className="section-icon">
                      <UsersIcon size={19} />
                    </span>
                    <div>
                      <h2>Personal information</h2>
                      <p>Identity and contact details</p>
                    </div>
                  </div>
                </div>

                <dl className="modern-details-grid">
                  <PersonalDetail
                    icon={CalendarIcon}
                    label="Date of birth"
                    value={formatDate(personal.dateOfBirth)}
                  />
                  <PersonalDetail
                    icon={UsersIcon}
                    label="Gender"
                    value={humanize(personal.gender)}
                  />
                  <PersonalDetail
                    icon={BloodIcon}
                    label="Blood group"
                    value={personal.bloodGroup}
                  />
                  <PersonalDetail
                    icon={PhoneIcon}
                    label="Phone"
                    value={personal.phone}
                  />
                  <PersonalDetail
                    icon={LanguagesIcon}
                    label="Preferred language"
                    value={personal.preferredLanguage}
                  />
                  <PersonalDetail
                    icon={MapPinIcon}
                    label="Location"
                    value={locationText}
                  />
                </dl>
              </Card>

              <Card className="modern-section-card care-notes-card">
                <div className="modern-section-card__heading">
                  <div>
                    <span className="section-icon">
                      <FileTextIcon size={19} />
                    </span>
                    <div>
                      <h2>Care notes</h2>
                      <p>Important context for coordinating care</p>
                    </div>
                  </div>
                </div>

                {personal.careNotes ? (
                  <p>{personal.careNotes}</p>
                ) : (
                  <SectionEmpty
                    icon={FileTextIcon}
                    title="No care notes"
                    description="General preferences and care context can be added while editing the profile."
                  />
                )}
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
                    onClick={() => {
                      selectTab("emergencyContacts");
                    }}
                  >
                    View all
                  </button>
                </div>

                {primaryContact ? (
                  <div className="primary-contact">
                    <span className="profile-avatar">
                      {primaryContact.name[0]}
                    </span>
                    <div>
                      <strong>{primaryContact.name}</strong>
                      <span>{primaryContact.relationship}</span>
                      <a href={"tel:" + primaryContact.phone}>
                        <PhoneIcon size={15} />
                        {primaryContact.phone}
                      </a>
                    </div>
                  </div>
                ) : (
                  <SectionEmpty
                    icon={PhoneIcon}
                    title="No primary contact"
                    description="Choose a primary emergency contact from the contact section."
                  />
                )}
              </Card>
            </div>
          )}

          {activeTab === "medicalHistory" && (
            <MedicalHistorySection items={profile.medicalHistory} />
          )}

          {activeTab === "allergies" && (
            <AllergySection items={profile.allergies} />
          )}

          {activeTab === "medications" && (
            <MedicationSection items={profile.medications} />
          )}

          {activeTab === "chronicDiseases" && (
            <ChronicDiseaseSection items={profile.chronicDiseases} />
          )}

          {activeTab === "emergencyContacts" && (
            <EmergencyContactSection items={profile.emergencyContacts} />
          )}
        </section>
      </div>

      <Modal
        isOpen={showArchive}
        title="Archive this profile?"
        onClose={closeArchiveModal}
      >
        <p>
          The health record will be preserved but removed from active profiles.
          This action is currently not reversible from the interface.
        </p>

        <div className="modal-actions">
          <Button
            variant="secondary"
            onClick={closeArchiveModal}
          >
            Cancel
          </Button>

          <Button
            isLoading={isArchiving}
            onClick={handleArchive}
          >
            <ArchiveIcon size={17} />
            Archive profile
          </Button>
        </div>
      </Modal>
    </main>
  );
}