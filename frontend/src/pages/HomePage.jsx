import { Link } from "react-router-dom";
import { CareNetworkVisual } from "../components/CareNetworkVisual.jsx";
import { Logo } from "../components/Logo.jsx";
import { ThemeToggle } from "../components/ThemeToggle.jsx";
import {
  ActivityIcon,
  ArrowRightIcon,
  BellIcon,
  CareIcon,
  CheckIcon,
  ClipboardListIcon,
  HeartPulseIcon,
  MapPinIcon,
  NetworkIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UsersIcon,
} from "../components/Icons.jsx";

const CAPABILITIES = [
  { icon: HeartPulseIcon, title: "Health context", text: "Essential care information stays organized and available." },
  { icon: ClipboardListIcon, title: "Daily updates", text: "Clear wellness reports turn distance into useful awareness." },
  { icon: BellIcon, title: "Emergency signals", text: "Important concerns surface quickly to the people who need to know." },
  { icon: MapPinIcon, title: "Local coordination", text: "Verified local support connects with family decisions abroad." },
];

const PLATFORM_FEATURES = [
  { icon: UsersIcon, label: "For families", title: "One calm view of the whole care picture", text: "Coordinate elderly profiles, health context, caregiver activity, and updates from a private family workspace.", points: ["Shared family visibility", "Structured elderly profiles", "Clear care history"] },
  { icon: CareIcon, label: "For caregivers", title: "A trusted path from application to care", text: "Caregivers build verified professional profiles, move through review, and work from a focused care workspace.", points: ["Administrator verification", "Professional care profile", "Purpose-built reporting"] },
  { icon: ActivityIcon, label: "Health aware", title: "Updates with the context to be useful", text: "Wellness reports and health records live together so families can understand change, not just receive messages.", points: ["Daily wellness context", "Vitals and observations", "Continuity over time"] },
];

const STEPS = [
  { number: "01", title: "Create a family space", text: "Set up a secure account and add the elderly relatives whose care you coordinate." },
  { number: "02", title: "Build the care network", text: "Connect approved caregivers and keep the right people aligned around each relative." },
  { number: "03", title: "Stay informed", text: "Follow structured updates, health context, and care signals from wherever you live." },
];

/**
 * Renders the experimental public ProbashiCare landing page.
 * @param {void} _unused - This page accepts no props.
 * @returns {import("react").ReactElement} Public landing page.
 * @sideEffects Navigates through React Router when a call to action is activated.
 */
export function HomePage() {
  return (
    <main className="public-home">
      <div className="public-aurora" aria-hidden="true"><span /><span /><span /></div>
      <header className="public-header">
        <Logo />
        <nav className="public-nav" aria-label="Public navigation">
          <a href="#platform">Platform</a>
          <a href="#how-it-works">How it works</a>
          <a href="#care-network">Care network</a>
        </nav>
        <div className="public-header__actions">
          <ThemeToggle />
          <Link className="public-sign-in" to="/login">Sign in</Link>
          <Link className="button button--primary public-header__cta" to="/signup">
            Get started <ArrowRightIcon size={17} />
          </Link>
        </div>
      </header>

      <section className="public-hero" id="care-network">
        <div className="public-hero__copy public-reveal public-reveal--one">
          <span className="public-kicker"><SparklesIcon size={15} /> Living Care Network</span>
          <h1>Care that stays connected, even when families live far apart.</h1>
          <p>ProbashiCare brings family, trusted local caregivers, and elderly health context into one calm coordination space.</p>
          <div className="public-hero__actions">
            <Link className="button button--primary button--large" to="/signup">
              Create your family space <ArrowRightIcon size={18} />
            </Link>
            <Link className="button button--secondary button--large" to="/caregiver/signup">
              Apply as a caregiver
            </Link>
          </div>
          <div className="public-trust" aria-label="Platform trust indicators">
            <span><ShieldCheckIcon size={17} /> Private family spaces</span>
            <span><CheckIcon size={17} /> Verified caregiver workflow</span>
            <span><NetworkIcon size={17} /> Built across distance</span>
          </div>
        </div>
        <div className="public-hero__visual public-reveal public-reveal--two">
          <CareNetworkVisual />
        </div>
      </section>

      <section className="capability-strip" aria-label="Core capabilities">
        {CAPABILITIES.map(({ icon: Icon, title, text }) => (
          <article key={title}>
            <span><Icon size={21} /></span>
            <div><strong>{title}</strong><p>{text}</p></div>
          </article>
        ))}
      </section>

      <section className="public-section" id="platform">
        <div className="public-section__heading">
          <span className="eyebrow">A coordinated platform</span>
          <h2>Designed around the relationships that make care work.</h2>
          <p>Every part of ProbashiCare is shaped to reduce uncertainty while keeping people, context, and responsibility clear.</p>
        </div>
        <div className="platform-grid">
          {PLATFORM_FEATURES.map(({ icon: Icon, label, title, text, points }, index) => (
            <article className={`platform-card public-reveal public-reveal--${index + 1}`} key={title}>
              <div className="platform-card__icon"><Icon size={24} /></div>
              <span>{label}</span>
              <h3>{title}</h3>
              <p>{text}</p>
              <ul>{points.map((point) => <li key={point}><CheckIcon size={15} /> {point}</li>)}</ul>
            </article>
          ))}
        </div>
      </section>

      <section className="public-section public-process" id="how-it-works">
        <div className="public-section__heading public-section__heading--split">
          <div><span className="eyebrow">How it works</span><h2>From distance to a shared rhythm of care.</h2></div>
          <p>Start with the people you care about, add trusted support, then build a reliable flow of health-aware updates.</p>
        </div>
        <ol className="process-grid">
          {STEPS.map((step) => (
            <li key={step.number}>
              <span>{step.number}</span><h3>{step.title}</h3><p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="caregiver-callout public-section">
        <div>
          <span className="public-kicker"><ShieldCheckIcon size={15} /> Verified local care</span>
          <h2>Professional caregivers deserve a professional pathway.</h2>
          <p>Build your profile, submit credentials for administrator review, and join a network designed for accountable elderly care.</p>
          <Link className="button button--caregiver button--large" to="/caregiver/signup">
            Start caregiver application <ArrowRightIcon size={18} />
          </Link>
        </div>
        <div className="caregiver-callout__status" aria-label="Caregiver application process">
          <span><CheckIcon size={17} /><strong>Account verified</strong><small>Secure email confirmation</small></span>
          <span><CheckIcon size={17} /><strong>Profile reviewed</strong><small>Professional information checked</small></span>
          <span><ActivityIcon size={17} /><strong>Care network ready</strong><small>Focused workspace after approval</small></span>
        </div>
      </section>

      <section className="final-cta">
        <span className="eyebrow">Begin with confidence</span>
        <h2>Make distance feel smaller.</h2>
        <p>Create a private family space and bring the people involved in care into one clear network.</p>
        <div><Link className="button button--primary button--large" to="/signup">Create your family space</Link><Link to="/login">Already have an account? Sign in</Link></div>
      </section>

      <footer className="public-footer">
        <Logo />
        <p>Thoughtful coordination for families, caregivers, and elderly loved ones.</p>
        <nav aria-label="Footer navigation"><a href="#platform">Platform</a><a href="#how-it-works">How it works</a><Link to="/login">Sign in</Link></nav>
      </footer>
    </main>
  );
}
