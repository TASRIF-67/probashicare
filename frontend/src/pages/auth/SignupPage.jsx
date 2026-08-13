import { GoogleLogin } from "@react-oauth/google";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AuthLayout } from "../../components/AuthLayout.jsx";
import { Button } from "../../components/Button.jsx";
import { Card } from "../../components/Card.jsx";
import { BriefcaseIcon, UserPlusIcon } from "../../components/Icons.jsx";
import { Input } from "../../components/Input.jsx";
import { SignupModeToggle } from "../../components/SignupModeToggle.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useTheme } from "../../context/ThemeContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useAuthRedirect } from "../../hooks/useAuthRedirect.js";
import { normalizeApiError } from "../../services/api.js";
import { authService } from "../../services/authService.js";

const SIGNUP_COPY = {
  family: {
    eyebrow: "Start with confidence",
    title: "A clearer way to care from abroad.",
    description: "Create your private family space. You can add one or more elderly relatives after signing in.",
    trustItems: ["Private by design", "Built for families abroad"],
  },
  caregiver: {
    eyebrow: "Join the care network",
    title: "Provide trusted care where it matters.",
    description: "Create your caregiver account, then submit your professional profile for administrator review.",
    trustItems: ["Private by design", "Verified care network"],
  },
};

/**
 * Renders the in-place Family/Caregiver signup experience.
 * @param {{initialMode?: "family"|"caregiver"}} props - Mode selected for the current direct-entry route.
 * @returns {import("react").ReactElement} Mode-aware hero/form with Family-only Google signup.
 * @sideEffects Changes the scoped accent, creates accounts, sends verification email, or starts a Family Google session.
 */
export function SignupPage({ initialMode = "family" }) {
  const [mode, setMode] = useState(initialMode);
  const [familyForm, setFamilyForm] = useState({ name: "", email: "", password: "" });
  const [caregiverForm, setCaregiverForm] = useState({ name: "", email: "", phone: "", password: "", confirmPassword: "" });
  const [errorsByMode, setErrorsByMode] = useState({ family: {}, caregiver: {} });
  const [messagesByMode, setMessagesByMode] = useState({ family: "", caregiver: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { loginWithGoogle } = useAuth();
  const { setAccentMode } = useTheme();
  const { showToast } = useToast();
  const redirectAfterLogin = useAuthRedirect();

  useEffect(() => {
    setMode(initialMode);
    setAccentMode(initialMode);
    return () => setAccentMode("family");
  }, [initialMode, setAccentMode]);

  /**
   * Changes signup mode and its accent without reloading or discarding either form.
   * @param {"family"|"caregiver"} nextMode - Newly selected account type.
   * @returns {void}
   * @sideEffects Updates page state and the shared theme context.
   */
  function handleModeChange(nextMode) {
    setMode(nextMode);
    setAccentMode(nextMode);
  }

  /**
   * Updates one field in the active signup form and clears its validation error.
   * @param {import("react").ChangeEvent<HTMLInputElement>} event - Changed signup input.
   * @returns {void}
   * @sideEffects Updates the selected form and error state.
   */
  function handleChange(event) {
    const { name, value } = event.target;
    const updateForm = mode === "family" ? setFamilyForm : setCaregiverForm;
    updateForm((current) => ({ ...current, [name]: value }));
    setErrorsByMode((current) => ({
      ...current,
      [mode]: { ...current[mode], [name]: undefined, form: undefined },
    }));
  }

  /**
   * Creates the active email/password account type.
   * @param {import("react").FormEvent<HTMLFormElement>} event - Signup form submission.
   * @returns {Promise<void>}
   * @sideEffects Calls the family or caregiver signup API and triggers verification delivery.
   */
  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorsByMode((current) => ({ ...current, [mode]: {} }));
    try {
      const data = mode === "family"
        ? await authService.signup(familyForm)
        : await authService.caregiverSignup(caregiverForm);
      setMessagesByMode((current) => ({ ...current, [mode]: data.message }));
    } catch (requestError) {
      const normalized = normalizeApiError(requestError);
      setErrorsByMode((current) => ({
        ...current,
        [mode]: { ...(normalized.details || {}), form: normalized.message },
      }));
    } finally {
      setIsSubmitting(false);
    }
  }

  /**
   * Creates or signs into a Family account through Google.
   * @param {{credential?: string}} result - Google Identity Services credential response.
   * @returns {Promise<void>}
   * @sideEffects Calls Family Google authentication, updates auth state, shows feedback, and redirects.
   */
  async function handleGoogleSuccess(result) {
    if (!result.credential) return;
    try {
      const user = await loginWithGoogle(result.credential);
      showToast("Family account ready.", "success");
      redirectAfterLogin(user);
    } catch (requestError) {
      setErrorsByMode((current) => ({
        ...current,
        [mode]: { form: normalizeApiError(requestError).message },
      }));
    }
  }

  const copy = SIGNUP_COPY[mode];
  const errors = errorsByMode[mode];
  const message = messagesByMode[mode];
  return (
    <AuthLayout
      {...copy}
      variant={mode}
      processItems={mode === "family"
        ? ["Create account", "Verify email", "Add care recipient"]
        : ["Create account", "Verify email", "Profile review"]}
      activeProcessIndex={0}
      headerAccessory={(
        <SignupModeToggle
          value={mode}
          onChange={handleModeChange}
        />
      )}
    >
      <Card className="auth-card signup-card">
        <span className="auth-card__kicker">
          {mode === "family" ? "Family registration" : "Caregiver registration"}
        </span>
        <div className="auth-card__heading"><h2>{mode === "family" ? "Create family account" : "Apply as a caregiver"}</h2><p>{mode === "family" ? "Set up your secure family care space." : "Administrator approval is required before providing care."}</p></div>
        {errors.form && <div className="alert alert--error">{errors.form}</div>}
        {message ? (
          <div className="success-panel"><h3>Check your inbox</h3><p>{message}</p><Link className="button button--primary" to={mode === "caregiver" ? "/login?mode=caregiver" : "/login"}>Return to sign in</Link></div>
        ) : (
          <>
            <form onSubmit={handleSubmit}>
              {mode === "family" ? <><Input id="family-name" name="name" label="Your name" autoComplete="name" value={familyForm.name} onChange={handleChange} error={errors.name} required /><Input id="family-email" name="email" type="email" label="Email address" autoComplete="email" value={familyForm.email} onChange={handleChange} error={errors.email} required /><Input id="family-password" name="password" type="password" label="Password" showPasswordToggle autoComplete="new-password" minLength="8" value={familyForm.password} onChange={handleChange} error={errors.password} required /><small className="field-hint">Use at least 8 characters.</small></> : <><Input id="caregiver-name" name="name" label="Full name" autoComplete="name" value={caregiverForm.name} onChange={handleChange} error={errors.name} required /><Input id="caregiver-email" name="email" type="email" label="Email address" autoComplete="email" value={caregiverForm.email} onChange={handleChange} error={errors.email} required /><Input id="caregiver-phone-signup" name="phone" type="tel" label="Phone number" autoComplete="tel" value={caregiverForm.phone} onChange={handleChange} error={errors.phone} required /><Input id="caregiver-password" name="password" type="password" label="Password" showPasswordToggle autoComplete="new-password" minLength="8" value={caregiverForm.password} onChange={handleChange} error={errors.password} required /><Input id="caregiver-confirm-password" name="confirmPassword" type="password" label="Confirm password" showPasswordToggle autoComplete="new-password" value={caregiverForm.confirmPassword} onChange={handleChange} error={errors.confirmPassword} required /></>}
              <Button type="submit" isLoading={isSubmitting}>{mode === "family" ? <><UserPlusIcon size={18} /> Create family account</> : <><BriefcaseIcon size={18} /> Register and apply</>}</Button>
            </form>
            {mode === "family" && <><div className="divider"><span>or</span></div><div className="google-button"><GoogleLogin text="signup_with" onSuccess={handleGoogleSuccess} onError={() => setErrorsByMode((current) => ({ ...current, family: { form: "Google sign-up was not completed." } }))} /></div></>}
            <p className="auth-card__footer">Already have an account? <Link to={mode === "caregiver" ? "/login?mode=caregiver" : "/login"}>Sign in</Link></p>
          </>
        )}
      </Card>
    </AuthLayout>
  );
}
