import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
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
import { createRevealMotion } from "../utils/motion.js";

/**
 * Displays one concise platform capability.
 * @param {object} props - Capability presentation values.
 * @param {import("react").ComponentType<object>} props.icon - Lucide icon component.
 * @param {string} props.title - Capability heading.
 * @param {string} props.description - Short capability explanation.
 * @param {number} [props.delay=0] - Small entrance delay in seconds.
 * @returns {import("react").ReactElement} One capability item.
 * @sideEffects None.
 */
function PlatformItem({
  icon: IconComponent,
  title,
  description,
  delay = 0,
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.article
      className="calm-platform-item"
      {...createRevealMotion(reduceMotion, { delay })}
    >
      <span className="calm-platform-item__icon" aria-hidden="true">
        <IconComponent />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
    </motion.article>
  );
}

/**
 * Displays one step in the public care-coordination workflow.
 * @param {object} props - Workflow step values.
 * @param {string} props.number - Two-digit step number.
 * @param {string} props.title - Step heading.
 * @param {string} props.description - Step explanation.
 * @param {number} [props.delay=0] - Small entrance delay in seconds.
 * @returns {import("react").ReactElement} One workflow step.
 * @sideEffects None.
 */
function CareStep({ number, title, description, delay = 0 }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.article
      className="calm-step"
      {...createRevealMotion(reduceMotion, { delay, distance: 12 })}
    >
      <span>{number}</span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </motion.article>
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
 * @param {number} [props.delay=0] - Small entrance delay in seconds.
 * @returns {import("react").ReactElement} One concise plan preview.
 * @sideEffects None.
 */
function PublicPlanOffer({
  name,
  price,
  period,
  description,
  featured = false,
  delay = 0,
}) {
  const reduceMotion = useReducedMotion();
  let className = "calm-offer-card";

  if (featured) {
    className += " calm-offer-card--featured";
  }

  return (
    <motion.article
      className={className}
      {...createRevealMotion(reduceMotion, { delay, distance: 14 })}
    >
      <div className="calm-offer-card__heading">
        <span>{period}</span>
        {featured && <small>Popular</small>}
      </div>
      <h3>{name}</h3>
      <strong>{price}</strong>
      <p>{description}</p>
    </motion.article>
  );
}

/**
 * Renders the public ProbashiCare landing page.
 * @returns {import("react").ReactElement} The complete public landing page.
 * @sideEffects React Router links navigate when activated.
 */
export function HomePage() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="public-home public-home--calm">
      <PublicHeader />

      <main>
        <section className="calm-hero" aria-labelledby="public-hero-title">
          <span className="calm-hero__decor-1" aria-hidden="true" />
          <span className="calm-hero__decor-2" aria-hidden="true" />
          <span className="calm-hero__decor-3" aria-hidden="true" />
          <div className="public-container calm-hero__layout">
            <motion.div
              className="calm-hero__copy"
              {...createRevealMotion(reduceMotion, { distance: 22 })}
            >
              <h1 id="public-hero-title">
                Miles apart. Still{" "}
                <span className="calm-hero__gradient-text">
                  there for them.
                </span>
              </h1>
              <p>
                Give your loved ones the care they deserve, wherever life takes you.
                Connect with local caregivers, plan visits, and stay close to
                the everyday moments that matter.
              </p>

              <div className="calm-hero__actions">
                <Link className="button calm-primary-action" to="/signup">
                  Start caring together
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
            </motion.div>

            <div className="home-care-scene">
              <div className="home-care-scene__heading"><span><HeartPulseIcon size={18} /> A circle of care</span><small>Made for your family</small></div>
              <motion.aside
                className="care-today"
                aria-label="Example daily care overview"
                {...createRevealMotion(reduceMotion, {
                  delay: 0.12,
                  distance: 26,
                })}
              >
                <header className="care-today__header">
                  <div>
                    <small>Example care overview</small>
                    <h2>Everything is on track</h2>
                  </div>
                  <span className="care-today__status">
                    <i className="care-today__live-dot" aria-hidden="true" />
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
              </motion.aside>
              <div className="home-care-scene__note"><span><ShieldCheckIcon size={21} /></span><div><strong>Peace of mind, wherever you are.</strong><p>Your family. Your care team. One shared space.</p></div></div>
            </div>
          </div>
        </section>

        <section className="calm-capabilities" aria-label="Core capabilities">
          <motion.div
            className="public-container calm-capabilities__grid"
            {...createRevealMotion(reduceMotion, { distance: 10 })}
          >
            <span><HeartPulseIcon /> Health context</span>
            <span><ClipboardListIcon /> Daily updates</span>
            <span><CalendarIcon /> Care bookings</span>
            <span><BellIcon /> Important signals</span>
          </motion.div>
        </section>

        <section
          className="calm-platform"
          id="platform"
          aria-labelledby="platform-title"
        >
          <div className="public-container">
            <motion.header
              className="calm-section-heading"
              {...createRevealMotion(reduceMotion)}
            >
              <h2 id="platform-title">
                Less worry. More connection.
              </h2>
              <p>
                ProbashiCare brings the information and people involved in care
                together without making the experience complicated.
              </p>
            </motion.header>

            <div className="calm-platform__grid">
              <PlatformItem
                icon={UsersIcon}
                delay={0.02}
                title="One family care space"
                description="Keep personal details, medical history, medications, allergies, and emergency contacts organized around your loved one."
              />
              <PlatformItem
                icon={BadgeCheckIcon}
                delay={0.09}
                title="Trusted local support"
                description="Review caregiver availability, choose a suitable date, and follow each booking from request to completion."
              />
              <PlatformItem
                icon={HeartPulseIcon}
                delay={0.16}
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
            <motion.div
              className="calm-network__copy"
              {...createRevealMotion(reduceMotion)}
            >
              <h2 id="network-title">Keep everyone involved in care.</h2>
              <p>
                Family members stay informed, caregivers receive clear assignments,
                and elderly health information remains protected by authorized access.
              </p>
              <ul>
                <li><CheckIcon /> Role-based access</li>
                <li><CheckIcon /> Private health context</li>
                <li><CheckIcon /> Clear care history</li>
              </ul>
            </motion.div>

            <motion.div
              className="calm-network__flow"
              aria-label="Connected care roles"
              {...createRevealMotion(reduceMotion, { delay: 0.1 })}
            >
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
            </motion.div>
          </div>
        </section>

        <section
          className="calm-process"
          id="how-it-works"
          aria-labelledby="process-title"
        >
          <div className="public-container">
            <motion.header
              className="calm-section-heading calm-section-heading--left"
              {...createRevealMotion(reduceMotion)}
            >
              <h2 id="process-title">Good care starts with a few simple steps.</h2>
            </motion.header>

            <div className="calm-process__steps">
              <CareStep
                number="01"
                delay={0.02}
                title="Create the care space"
                description="Add the elderly profile and the family members who are allowed to help."
              />
              <CareStep
                number="02"
                delay={0.09}
                title="Arrange trusted care"
                description="Find a caregiver and choose a schedule that matches their availability."
              />
              <CareStep
                number="03"
                delay={0.16}
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
            <motion.div
              className="calm-offers__intro"
              {...createRevealMotion(reduceMotion)}
            >
              <div>
                <h2 id="offers-title">Choose your plan</h2>
              </div>
              <div>
                <p>
                  All plans include caregiver bookings, wellness reports, and health
                  alerts. Choose the duration that suits your family.
                </p>
                <span className="calm-offers__trial">
                  <CheckIcon aria-hidden="true" />
                  Eligible family accounts get a 7-day trial.
                </span>
              </div>
            </motion.div>

            <div className="calm-offers__plans">
              <PublicPlanOffer
                name="Day Pass"
                price="BDT 199"
                period="24 hours"
                description="Premium access for 24 hours."
                delay={0.02}
              />
              <PublicPlanOffer
                name="Monthly"
                price="BDT 1,499"
                period="1 month"
                description="A month of care planning and updates."
                featured
                delay={0.09}
              />
              <PublicPlanOffer
                name="Yearly"
                price="BDT 14,999"
                period="1 year"
                description="A full year of Premium access."
                delay={0.16}
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
            <motion.h2
              id="roles-title"
              {...createRevealMotion(reduceMotion)}
            >
              Choose how you want to take part.
            </motion.h2>
            <motion.div
              className="calm-roles__grid"
              {...createRevealMotion(reduceMotion, { delay: 0.08 })}
            >
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
            </motion.div>
          </div>
        </section>

        <section className="calm-final-cta" aria-labelledby="final-cta-title">
          <motion.div
            className="public-container calm-final-cta__layout"
            {...createRevealMotion(reduceMotion)}
          >
            <div>
              <span>Begin with one family care space</span>
              <h2 id="final-cta-title">Make distance easier to care across.</h2>
            </div>
            <Link className="button calm-final-cta__button" to="/signup">
              Get started
              <ArrowRightIcon aria-hidden="true" />
            </Link>
          </motion.div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
