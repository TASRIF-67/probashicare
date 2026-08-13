import { GoogleLogin } from "@react-oauth/google";
import { useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { AuthLayout } from "../../components/AuthLayout.jsx";
import { Button } from "../../components/Button.jsx";
import { Card } from "../../components/Card.jsx";
import { Input } from "../../components/Input.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useAuthRedirect } from "../../hooks/useAuthRedirect.js";
import { normalizeApiError } from "../../services/api.js";
import { BadgeCheckIcon, LogInIcon } from "../../components/Icons.jsx";
import { CaregiverTheme } from "../../components/caregiver/CaregiverTheme.jsx";

/**
 * Renders family/caregiver/admin email login and family Google login.
 * @param {void} _unused - This page accepts no props.
 * @returns {import("react").ReactElement} Login route content.
 * @sideEffects Submits authentication requests and redirects on success.
 */
export function LoginPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isCaregiverMode = searchParams.get("mode") === "caregiver";
  const verificationNotice = location.state?.verificationNotice || "";
  const verificationEmail = location.state?.verificationEmail || "";
  const [form, setForm] = useState({
    email: verificationEmail,
    password: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { login, loginWithGoogle } = useAuth();
  const { showToast } = useToast();
  const redirectAfterLogin = useAuthRedirect();

  /**
   * Updates one controlled login field.
   * @param {import("react").ChangeEvent<HTMLInputElement>} event - Changed input event.
   * @returns {void}
   * @sideEffects Updates component state.
   */
  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  /**
   * Submits email/password credentials.
   * @param {import("react").FormEvent<HTMLFormElement>} event - Form submission event.
   * @returns {Promise<void>}
   * @sideEffects Calls login API, updates UI state, shows a toast, and may navigate.
   */
  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      const user = await login(form);
      showToast("Welcome back.", "success");
      redirectAfterLogin(user);
    } catch (requestError) {
      setError(normalizeApiError(requestError).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  /**
   * Exchanges a successful Google browser credential for a server session.
   * @param {{credential?: string}} result - Google Identity Services response.
   * @returns {Promise<void>}
   * @sideEffects Calls Google login API, shows feedback, and may navigate.
   */
  async function handleGoogleSuccess(result) {
    if (!result.credential) return;
    try {
      const user = await loginWithGoogle(result.credential);
      showToast("Signed in with Google.", "success");
      redirectAfterLogin(user);
    } catch (requestError) {
      setError(normalizeApiError(requestError).message);
    }
  }

  const content = (
    <AuthLayout
      eyebrow={isCaregiverMode ? "Caregiver access" : "Care, across every distance"}
      title={isCaregiverMode ? "Continue your care application." : "Stay close to the people who raised you."}
      description={isCaregiverMode ? "Sign in to complete your professional profile, review your application status, or manage approved caregiver work." : "Coordinate trusted care in Bangladesh from wherever life has taken you."}
      trustItems={isCaregiverMode ? ["Private by design", "Verified care network"] : undefined}
      variant={isCaregiverMode ? "caregiver" : "family"}
      processItems={isCaregiverMode
        ? ["Sign in", "Review assignments", "Share updates"]
        : ["Sign in", "Open family space", "Coordinate care"]}
      activeProcessIndex={0}
    >
      <Card className="auth-card">
        <span className="auth-card__kicker">
          {isCaregiverMode ? "Caregiver account" : "Family account"}
        </span>
        <div className="auth-card__heading">
          <h2>Sign in</h2>
          <p>{isCaregiverMode ? "Continue to your caregiver workspace." : "Continue to your secure care workspace."}</p>
        </div>
        {verificationNotice && (
          <div className="success-panel auth-verification-notice" role="status">
            <BadgeCheckIcon size={20} />
            <div>
              <strong>Verify your new email</strong>
              <p>{verificationNotice}</p>
            </div>
          </div>
        )}
        {error && <div className="alert alert--error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <Input id="email" name="email" type="email" label="Email address" autoComplete="email" value={form.email} onChange={handleChange} required />
          <Input id="password" name="password" type="password" label="Password" showPasswordToggle autoComplete="current-password" value={form.password} onChange={handleChange} required />
          <Button type="submit" isLoading={isSubmitting}><LogInIcon size={18} /> Sign in</Button>
        </form>
        {!isCaregiverMode && <><div className="divider"><span>or</span></div><div className="google-button"><GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError("Google sign-in was not completed.")} /></div></>}
        {isCaregiverMode ? <><p className="auth-card__footer">Need a caregiver account? <Link to="/caregiver/signup">Apply as a Caregiver</Link></p><p className="auth-card__footer auth-card__footer--secondary">Signing in as a family member? <Link to="/login">Family sign in</Link></p></> : <><p className="auth-card__footer">New to ProbashiCare? <Link to="/signup">Create a family account</Link></p><p className="auth-card__footer auth-card__footer--secondary">Want to provide care? <Link to="/caregiver/signup">Apply as a Caregiver</Link></p></>}
      </Card>
    </AuthLayout>
  );
  return isCaregiverMode ? <CaregiverTheme>{content}</CaregiverTheme> : content;
}
