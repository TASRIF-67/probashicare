import { GoogleLogin } from "@react-oauth/google";
import { useState } from "react";
import { Link } from "react-router-dom";
import { AuthLayout } from "../../components/AuthLayout.jsx";
import { Button } from "../../components/Button.jsx";
import { Card } from "../../components/Card.jsx";
import { Input } from "../../components/Input.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useAuthRedirect } from "../../hooks/useAuthRedirect.js";
import { normalizeApiError } from "../../services/api.js";
import { authService } from "../../services/authService.js";
import { UserPlusIcon } from "../../components/Icons.jsx";

/**
 * Renders family-only email and Google account creation.
 * @param {void} _unused - This page accepts no props.
 * @returns {import("react").ReactElement} Signup route content.
 * @sideEffects Creates accounts, sends verification email, or starts a Google session.
 */
export function SignupPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { loginWithGoogle } = useAuth();
  const { showToast } = useToast();
  const redirectAfterLogin = useAuthRedirect();

  /**
   * Updates a controlled signup field and clears its server validation error.
   * @param {import("react").ChangeEvent<HTMLInputElement>} event - Changed input event.
   * @returns {void}
   * @sideEffects Updates component state.
   */
  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined, form: undefined }));
  }

  /**
   * Creates an email/password family account.
   * @param {import("react").FormEvent<HTMLFormElement>} event - Form submission event.
   * @returns {Promise<void>}
   * @sideEffects Calls signup API, writes UI state, and triggers verification email server-side.
   */
  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrors({});
    try {
      const data = await authService.signup(form);
      setMessage(data.message);
    } catch (requestError) {
      const normalized = normalizeApiError(requestError);
      setErrors({ ...(normalized.details || {}), form: normalized.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  /**
   * Creates or signs into a family account using Google.
   * @param {{credential?: string}} result - Google Identity Services response.
   * @returns {Promise<void>}
   * @sideEffects Calls the API, stores auth state, shows feedback, and navigates.
   */
  async function handleGoogleSuccess(result) {
    if (!result.credential) return;
    try {
      const user = await loginWithGoogle(result.credential);
      showToast("Family account ready.", "success");
      redirectAfterLogin(user);
    } catch (requestError) {
      setErrors({ form: normalizeApiError(requestError).message });
    }
  }

  return (
    <AuthLayout eyebrow="Start with confidence" title="A clearer way to care from abroad." description="Create your private family space. You can add one or more elderly relatives after signing in.">
      <Card className="auth-card">
        <div className="auth-card__heading"><h2>Create family account</h2><p>Set up your secure family care space.</p></div>
        {errors.form && <div className="alert alert--error">{errors.form}</div>}
        {message ? (
          <div className="success-panel"><h3>Check your inbox</h3><p>{message}</p><Link className="button button--primary" to="/login">Return to sign in</Link></div>
        ) : (
          <>
            <form onSubmit={handleSubmit}>
              <Input id="name" name="name" label="Your name" autoComplete="name" value={form.name} onChange={handleChange} error={errors.name} required />
              <Input id="email" name="email" type="email" label="Email address" autoComplete="email" value={form.email} onChange={handleChange} error={errors.email} required />
              <Input id="password" name="password" type="password" label="Password" showPasswordToggle autoComplete="new-password" minLength="8" value={form.password} onChange={handleChange} error={errors.password} required />
              <small className="field-hint">Use at least 8 characters.</small>
              <Button type="submit" isLoading={isSubmitting}><UserPlusIcon size={18} /> Create account</Button>
            </form>
            <div className="divider"><span>or</span></div>
            <div className="google-button"><GoogleLogin text="signup_with" onSuccess={handleGoogleSuccess} onError={() => setErrors({ form: "Google sign-up was not completed." })} /></div>
            <p className="auth-card__footer">Already have an account? <Link to="/login">Sign in</Link></p>
          </>
        )}
      </Card>
    </AuthLayout>
  );
}
