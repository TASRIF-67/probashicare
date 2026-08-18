import { GoogleLogin } from "@react-oauth/google";
import { useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { AuthLayout } from "../../components/AuthLayout.jsx";
import { Button } from "../../components/Button.jsx";
import { Card } from "../../components/Card.jsx";
import {
  BadgeCheckIcon,
  BriefcaseIcon,
  LogInIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "../../components/Icons.jsx";
import { Input } from "../../components/Input.jsx";
import { CaregiverTheme } from "../../components/caregiver/CaregiverTheme.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useAuthRedirect } from "../../hooks/useAuthRedirect.js";
import { normalizeApiError } from "../../services/api.js";

/**
 * Renders family, caregiver, and administrator email login with Family Google login.
 * @returns {import("react").ReactElement} Login route content.
 * @sideEffects Submits authentication requests and redirects after successful login.
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
   * @sideEffects Updates the login form state.
   */
  function handleChange(event) {
    const fieldName = event.target.name;
    const fieldValue = event.target.value;

    setForm(function updateLoginForm(current) {
      return {
        ...current,
        [fieldName]: fieldValue,
      };
    });
  }

  /**
   * Submits email and password credentials.
   * @param {import("react").FormEvent<HTMLFormElement>} event - Form submission event.
   * @returns {Promise<void>} Resolves after the login request finishes.
   * @sideEffects Calls the login API, updates UI state, shows a toast, and may navigate.
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
      const normalizedError = normalizeApiError(requestError);
      setError(normalizedError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  /**
   * Exchanges a successful Google browser credential for a server session.
   * @param {{credential?: string}} result - Google Identity Services response.
   * @returns {Promise<void>} Resolves after the Google login request finishes.
   * @sideEffects Calls Google login, shows feedback, and may navigate.
   */
  async function handleGoogleSuccess(result) {
    if (!result.credential) {
      return;
    }

    try {
      const user = await loginWithGoogle(result.credential);
      showToast("Signed in with Google.", "success");
      redirectAfterLogin(user);
    } catch (requestError) {
      const normalizedError = normalizeApiError(requestError);
      setError(normalizedError.message);
    }
  }

  /**
   * Shows a stable error when the Google account dialog cannot finish.
   * @returns {void}
   * @sideEffects Updates the visible login error message.
   */
  function handleGoogleError() {
    setError("Google sign-in was not completed.");
  }

  const accountLabel = isCaregiverMode
    ? "Caregiver workspace"
    : "Family workspace";
  const accountDescription = isCaregiverMode
    ? "Access assignments, care reports, and your professional profile."
    : "Access care profiles, bookings, wellness updates, and alerts.";

  const content = (
    <AuthLayout
      eyebrow={isCaregiverMode ? "Caregiver access" : "Welcome back"}
      title={isCaregiverMode ? "Continue the care work that matters." : "Your family care space is ready."}
      description={isCaregiverMode
        ? "Sign in to review assignments, record care, and keep families informed."
        : "Sign in to see the latest care activity from home, without searching through messages and calls."}
      trustItems={isCaregiverMode
        ? ["Verified care network", "Private care records"]
        : ["Authorized family access", "Private health context"]}
      variant={isCaregiverMode ? "caregiver" : "family"}
      processItems={isCaregiverMode
        ? ["Sign in", "Review assignments", "Share updates"]
        : ["Sign in", "Open family space", "Coordinate care"]}
      activeProcessIndex={0}
    >
      <Card className="auth-card auth-card--login">
        <div className="auth-card__account">
          <span aria-hidden="true">
            {isCaregiverMode ? <BriefcaseIcon /> : <UsersIcon />}
          </span>
          <div>
            <strong>{accountLabel}</strong>
            <small>{accountDescription}</small>
          </div>
        </div>

        <div className="auth-card__heading">
          <h2>Sign in</h2>
          <p>Enter the email and password connected to your account.</p>
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

        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <Input
            id="email"
            name="email"
            type="email"
            label="Email address"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            required
          />
          <Input
            id="password"
            name="password"
            type="password"
            label="Password"
            showPasswordToggle
            autoComplete="current-password"
            value={form.password}
            onChange={handleChange}
            required
          />
          <Button type="submit" isLoading={isSubmitting}>
            <LogInIcon size={18} />
            Sign in securely
          </Button>
        </form>

        {!isCaregiverMode && (
          <>
            <div className="divider">
              <span>or continue with</span>
            </div>
            <div className="google-button">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
              />
            </div>
          </>
        )}

        <div className="auth-card__links">
          {isCaregiverMode ? (
            <>
              <p>
                Need a caregiver account?{" "}
                <Link to="/caregiver/signup">Apply as a caregiver</Link>
              </p>
              <p>
                Signing in for your family?{" "}
                <Link to="/login">Use family access</Link>
              </p>
            </>
          ) : (
            <>
              <p>
                New to ProbashiCare?{" "}
                <Link to="/signup">Create a family account</Link>
              </p>
              <p>
                Are you a caregiver?{" "}
                <Link to="/login?mode=caregiver">Use caregiver access</Link>
              </p>
            </>
          )}
        </div>

        <div className="auth-card__assurance">
          <ShieldCheckIcon size={15} />
          Email verification is required for account security.
        </div>
      </Card>
    </AuthLayout>
  );

  if (isCaregiverMode) {
    return <CaregiverTheme>{content}</CaregiverTheme>;
  }

  return content;
}
