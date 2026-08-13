import { Link } from "react-router-dom";
import "../styles/home.css";
import { PublicFooter } from "../components/public/PublicFooter.jsx";
import { PublicHeader } from "../components/public/PublicHeader.jsx";
import {
  ActivityIcon,
  ArrowRightIcon,
  BadgeCheckIcon,
  BellIcon,
  CalendarIcon,
  CheckIcon,
  ClipboardListIcon,
  HeartPulseIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "../components/Icons.jsx";

/**
 * Displays one concise platform capability.
 * @param {object} props - Capability presentation values.
 * @param {import("react").ComponentType<object>} props.icon - Lucide icon component.
 * @param {string} props.title - Capability heading.
 * @param {string} props.description - Short capability explanation.
 * @returns {import("react").ReactElement} One capability item.
 * @sideEffects None.
 */
function PlatformItem({ icon: IconComponent, title, description }) {
  return (
    <article className="calm-platform-item">
      <span className="calm-platform-item__icon" aria-hidden="true">
        <IconComponent />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  );
}

/**
 * Displays one step in the public care-coordination workflow.
 * @param {object} props - Workflow step values.
 * @param {string} props.number - Two-digit step number.
 * @param {string} props.title - Step heading.
 * @param {string} props.description - Step explanation.
 * @returns {import("react").ReactElement} One workflow step.
 * @sideEffects None.
 */
function CareStep({ number, title, description }) {
  return (
    <article className="calm-step">
      <span>{number}</span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </article>
  );
}

/**
 * Displays one public prototype subscription offer.
 * @param {object} props - Offer presentation values.
 * @param {string} props.name - Public plan name.
 * @param {string} props.price - Prototype price text.
 * @param {string} props.period - Access duration text.
 * @param {string} props.description - Short plan explanation.
 * @param {boolean} [props.featured=false] - Whether the plan receives the recommended treatment.
 * @returns {import("react").ReactElement} One concise plan preview.
 * @sideEffects None.
 */
function PublicPlanOffer({
  name,
  price,
  period,
  description,
  featured = false,
}) {
  let className = "calm-offer-card";

  if (featured) {
    className += " calm-offer-card--featured";
  }

  return (
    <article className={className}>
      <div className="calm-offer-card__heading">
        <span>{period}</span>
        {featured && <small>Popular</small>}
      </div>
      <h3>{name}</h3>
      <strong>{price}</strong>
      <p>{description}</p>
    </article>
  );
}

/**
 * Renders the public ProbashiCare landing page.
 * @returns {import("react").ReactElement} The complete public landing page.
 * @sideEffects React Router links navigate when activated.
 */
export function HomePage() {
  return (
    <div className="public-home public-home--calm">
      <PublicHeader />

      <main>
        <section className="calm-hero" aria-labelledby="public-hero-title">
          <div className="public-container calm-hero__layout">
            <div className="calm-hero__copy">
              <span className="calm-eyebrow">
                Remote elderly care coordination
              </span>
              <h1 id="public-hero-title">
                Care for home, even when you are far away.
              </h1>
              <p>
                Keep your family, loved one, and trusted local caregiver in one
                clear care space for bookings, wellness updates, and important
                health context.
              </p>

              <div className="calm-hero__actions">
                <Link className="button calm-primary-action" to="/signup">
                  Create your family space
                  <ArrowRightIcon aria-hidden="true" />
                </Link>
                <Link className="calm-secondary-action" to="/caregiver/signup">
                  Apply as a caregiver
                </Link>
              </div>

              <div className="calm-hero__trust">
                <span>
                  <ShieldCheckIcon aria-hidden="true" />
                  Authorized access
                </span>
                <span>
                  <BadgeCheckIcon aria-hidden="true" />
                  Verified caregivers
                </span>
              </div>
            </div>

            <aside className="care-today" aria-label="Example daily care overview">
              <header className="care-today__header">
                <div>
                  <small>Today&apos;s care</small>
                  <h2>Everything is on track</h2>
                </div>
                <span className="care-today__status">
                  <CheckIcon aria-hidden="true" />
                  All well
                </span>
              </header>

              <div className="care-today__person">
                <span className="care-today__avatar" aria-hidden="true">
                  M
                </span>
                <div>
                  <strong>Masnun&apos;s care space</strong>
                  <span>Dhaka, Bangladesh</span>
                </div>
              </div>

              <ol className="care-today__timeline">
                <li>
                  <time>09:00</time>
                  <BadgeCheckIcon aria-hidden="true" />
                  <span>
                    <strong>Caregiver checked in</strong>
                    Morning visit started
                  </span>
                </li>
                <li>
                  <time>12:15</time>
                  <ClipboardListIcon aria-hidden="true" />
                  <span>
                    <strong>Wellness report shared</strong>
                    Daily observations recorded
                  </span>
                </li>
                <li>
                  <time>12:16</time>
                  <BellIcon aria-hidden="true" />
                  <span>
                    <strong>Family notified</strong>
                    Update delivered securely
                  </span>
                </li>
              </ol>

              <footer className="care-today__footer">
                <ActivityIcon aria-hidden="true" />
                One simple view of the day&apos;s care
              </footer>
            </aside>
          </div>
        </section>

        <section className="calm-capabilities" aria-label="Core capabilities">
          <div className="public-container calm-capabilities__grid">
            <span><HeartPulseIcon /> Health context</span>
            <span><ClipboardListIcon /> Daily updates</span>
            <span><CalendarIcon /> Care bookings</span>
            <span><BellIcon /> Important signals</span>
          </div>
        </section>

        <section
          className="calm-platform"
          id="platform"
          aria-labelledby="platform-title"
        >
          <div className="public-container">
            <header className="calm-section-heading">
              <span className="calm-eyebrow">The platform</span>
              <h2 id="platform-title">
                The essentials of care, clearly connected.
              </h2>
              <p>
                ProbashiCare brings the information and people involved in care
                together without making the experience complicated.
              </p>
            </header>

            <div className="calm-platform__grid">
              <PlatformItem
                icon={UsersIcon}
                title="One family care space"
                description="Keep personal details, medical history, medications, allergies, and emergency contacts organized around your loved one."
              />
              <PlatformItem
                icon={BadgeCheckIcon}
                title="Trusted local support"
                description="Review caregiver availability, choose a suitable date, and follow each booking from request to completion."
              />
              <PlatformItem
                icon={HeartPulseIcon}
                title="Health-aware updates"
                description="See wellness reports, vital trends, and important changes shared by the people providing daily care."
              />
            </div>
          </div>
        </section>

        <section
          className="calm-network"
          id="care-network"
          aria-labelledby="network-title"
        >
          <div className="public-container calm-network__layout">
            <div className="calm-network__copy">
              <span className="calm-eyebrow">Care network</span>
              <h2 id="network-title">The right update reaches the right person.</h2>
              <p>
                Family members stay informed, caregivers receive clear assignments,
                and elderly health information remains protected by authorized access.
              </p>
              <ul>
                <li><CheckIcon /> Role-based access</li>
                <li><CheckIcon /> Private health context</li>
                <li><CheckIcon /> Clear care history</li>
              </ul>
            </div>

            <div className="calm-network__flow" aria-label="Connected care roles">
              <div>
                <UsersIcon aria-hidden="true" />
                <strong>Family</strong>
                <span>Plans and reviews</span>
              </div>
              <span className="calm-network__line" aria-hidden="true" />
              <div>
                <BadgeCheckIcon aria-hidden="true" />
                <strong>Caregiver</strong>
                <span>Provides and reports</span>
              </div>
              <span className="calm-network__line" aria-hidden="true" />
              <div>
                <HeartPulseIcon aria-hidden="true" />
                <strong>Care recipient</strong>
                <span>Always at the centre</span>
              </div>
            </div>
          </div>
        </section>

        <section
          className="calm-process"
          id="how-it-works"
          aria-labelledby="process-title"
        >
          <div className="public-container">
            <header className="calm-section-heading calm-section-heading--left">
              <span className="calm-eyebrow">How it works</span>
              <h2 id="process-title">A straightforward path to better coordination.</h2>
            </header>

            <div className="calm-process__steps">
              <CareStep
                number="01"
                title="Create the care space"
                description="Add the elderly profile and the family members who are allowed to help."
              />
              <CareStep
                number="02"
                title="Arrange trusted care"
                description="Find a caregiver and choose a schedule that matches their availability."
              />
              <CareStep
                number="03"
                title="Stay informed"
                description="Follow booking status, wellness reports, and important health changes."
              />
            </div>
          </div>
        </section>

        <section
          className="calm-offers"
          id="plans"
          aria-labelledby="offers-title"
        >
          <div className="public-container">
            <div className="calm-offers__intro">
              <div>
                <span className="calm-eyebrow">Premium options</span>
                <h2 id="offers-title">More care tools, only when you need them.</h2>
              </div>
              <div>
                <p>
                  Every paid plan includes the same Premium caregiver coordination
                  and wellness intelligence tools. You only choose how long you need access.
                </p>
                <span className="calm-offers__trial">
                  <CheckIcon aria-hidden="true" />
                  Eligible Family accounts can begin with a seven-day trial.
                </span>
              </div>
            </div>

            <div className="calm-offers__plans">
              <PublicPlanOffer
                name="Day Pass"
                price="BDT 199"
                period="24 hours"
                description="Useful when you need Premium tools for a focused day of care."
              />
              <PublicPlanOffer
                name="Monthly"
                price="BDT 1,499"
                period="1 month"
                description="A practical choice for ongoing family care coordination."
                featured
              />
              <PublicPlanOffer
                name="Yearly"
                price="BDT 14,999"
                period="1 year"
                description="Longer Premium access at the current prototype discount."
              />
            </div>

            <div className="calm-offers__footer">
              <p>
                Prototype pricing for development and testing. Payments are simulated,
                and plans do not renew automatically.
              </p>
              <Link to="/signup">
                Create an account to explore Premium
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <section className="calm-roles" aria-labelledby="roles-title">
          <div className="public-container">
            <h2 id="roles-title">Choose how you want to take part.</h2>
            <div className="calm-roles__grid">
              <article>
                <span>For families</span>
                <h3>Stay present from anywhere.</h3>
                <p>Organize care and follow every meaningful update.</p>
                <Link to="/signup">
                  Create family account
                  <ArrowRightIcon aria-hidden="true" />
                </Link>
              </article>
              <article className="calm-roles__caregiver">
                <span>For caregivers</span>
                <h3>Build trust through visible care.</h3>
                <p>Manage assignments and report care professionally.</p>
                <Link to="/caregiver/signup">
                  Apply as caregiver
                  <ArrowRightIcon aria-hidden="true" />
                </Link>
              </article>
            </div>
          </div>
        </section>

        <section className="calm-final-cta" aria-labelledby="final-cta-title">
          <div className="public-container calm-final-cta__layout">
            <div>
              <span>Begin with one family care space</span>
              <h2 id="final-cta-title">Make distance easier to care across.</h2>
            </div>
            <Link className="button calm-final-cta__button" to="/signup">
              Get started
              <ArrowRightIcon aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
