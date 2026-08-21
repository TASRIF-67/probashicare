import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthLayout } from "../../components/AuthLayout.jsx";
import { Button } from "../../components/Button.jsx";
import { Card } from "../../components/Card.jsx";
import {
  ArrowLeftIcon,
  BadgeCheckIcon,
  BriefcaseIcon,
  SendIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "../../components/Icons.jsx";
import { Input } from "../../components/Input.jsx";
import { CaregiverTheme } from "../../components/caregiver/CaregiverTheme.jsx";
import { normalizeApiError } from "../../services/api.js";
import { authService } from "../../services/authService.js";

/**
 * Requests a one-time password-reset link for a Family, Caregiver, or Admin
 * password account without revealing whether the address is registered.
 * @returns {import("react").ReactElement} Forgot-password request page.
 * @sideEffects Calls the recovery API and may trigger an SMTP email.
 */
export function ForgotPasswordPage() {
  const [searchParams] = useSearchParams();
  const isCaregiverMode = searchParams.get("mode") === "caregiver";
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const loginPath = isCaregiverMode ? "/login?mode=caregiver" : "/login";

  /**
   * Stores the controlled email value and clears old request errors.
   * @param {import("react").ChangeEvent<HTMLInputElement>} event - Email input event.
   * @returns {void}
   * @sideEffects Updates local form state.
   */
  function handleEmailChange(event) {
    setEmail(event.target.value);
    setError("");
  }

  /**
   * Requests a password-reset email for the entered address.
   * @param {import("react").FormEvent<HTMLFormElement>} event - Form submission event.
   * @returns {Promise<void>} Resolves after the request completes.
   * @sideEffects Calls the authentication API and updates visible feedback.
   */
  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const result = await authService.forgotPassword(email.trim());
      setMessage(result.message);
    } catch (requestError) {
      const normalizedError = normalizeApiError(requestError);
      setError(normalizedError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const content = (
    <AuthLayout
      eyebrow={isCaregiverMode ? "Caregiver account recovery" : "Family account recovery"}
      title="A secure way back to your care workspace."
      description="Request a time-limited link, choose a new password, and continue coordinating care."
      trustItems={["One-time recovery link", "One-hour expiry"]}
      variant={isCaregiverMode ? "caregiver" : "family"}
      processItems={["Request link", "Open email", "Choose password"]}
      activeProcessIndex={0}
    >
      <Card className="auth-card auth-card--recovery">
        <div className="auth-card__account">
          <span aria-hidden="true">
            {isCaregiverMode ? <BriefcaseIcon /> : <UsersIcon />}
          </span>
          <div>
            <strong>
              {isCaregiverMode ? "Caregiver recovery" : "Family recovery"}
            </strong>
          </div>
        </div>

        <div className="auth-card__heading">
          <h2>Forgot your password?</h2>
          <p>
            Enter the email address connected to your account. We will send a
            secure reset link if it belongs to a password account.
          </p>
        </div>

        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}

        {message ? (
          <div className="auth-recovery-success" role="status">
            <span aria-hidden="true">
              <BadgeCheckIcon size={24} />
            </span>
            <div>
              <h3>Check your inbox</h3>
              <p>{message}</p>
              <small>The link can be used once and expires after one hour.</small>
            </div>
            <Link className="button button--primary" to={loginPath}>
              <ArrowLeftIcon size={16} />
              Return to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <Input
              id="recovery-email"
              name="email"
              type="email"
              label="Email address"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={handleEmailChange}
              required
            />
            <Button type="submit" isLoading={isSubmitting}>
              <SendIcon size={17} />
              Send reset link
            </Button>
          </form>
        )}

        {!message && (
          <Link className="auth-recovery-back" to={loginPath}>
            <ArrowLeftIcon size={15} />
            Back to sign in
          </Link>
        )}

        <div className="auth-card__assurance">
          <ShieldCheckIcon size={15} />
          For privacy, the confirmation is the same for every email address.
        </div>
      </Card>
    </AuthLayout>
  );

  if (isCaregiverMode) {
    return <CaregiverTheme>{content}</CaregiverTheme>;
  }

  return content;
}
