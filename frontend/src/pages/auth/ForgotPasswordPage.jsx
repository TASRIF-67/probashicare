import { useState } from "react";
import {
  Link,
  useSearchParams,
} from "react-router-dom";
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
import {
  CaregiverTheme,
} from "../../components/caregiver/CaregiverTheme.jsx";
import { normalizeApiError } from "../../services/api.js";
import { authService } from "../../services/authService.js";

/**
 * Requests a reset link without revealing whether an account exists.
 * @returns {import("react").ReactElement} Forgot-password page.
 * @sideEffects Calls recovery API and may trigger SMTP email.
 */
export function ForgotPasswordPage() {
  const [searchParams] = useSearchParams();
  const isCaregiverMode =
    searchParams.get("mode") === "caregiver";
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] =
    useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  let loginPath = "/login";
  let eyebrow = "Family account recovery";
  let accountLabel = "Family recovery";
  let accountIcon = <UsersIcon />;
  let variant = "family";

  if (isCaregiverMode) {
    loginPath = "/login?mode=caregiver";
    eyebrow = "Caregiver account recovery";
    accountLabel = "Caregiver recovery";
    accountIcon = <BriefcaseIcon />;
    variant = "caregiver";
  }

  /**
   * Stores controlled email and clears the previous request error.
   * @param {import("react").ChangeEvent<HTMLInputElement>} event - Input event.
   * @returns {void}
   * @sideEffects Updates local state.
   */
  function handleEmailChange(event) {
    setEmail(event.target.value);
    setError("");
  }

  /**
   * Requests a password-reset email for the entered address.
   * @param {import("react").FormEvent<HTMLFormElement>} event - Submit event.
   * @returns {Promise<void>}
   * @sideEffects Calls API and updates visible feedback.
   */
  async function handleSubmit(event) {
    // Execution sequence:
    // 1. Prevent reload, lock the form, and normalize the email.
    // 2. Request a privacy-safe reset response from the backend.
    // 3. Show success/error and always unlock submission.
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const normalizedEmail =
        email.trim();
      const result =
        await authService.forgotPassword(
          normalizedEmail,
        );
      setMessage(result.message);
    } catch (requestError) {
      const normalizedError =
        normalizeApiError(requestError);
      setError(normalizedError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  let recoveryContent = (
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
      <Button
        type="submit"
        isLoading={isSubmitting}
        disabled={isSubmitting}
      >
        <SendIcon size={17} />
        Send reset link
      </Button>
    </form>
  );

  if (message) {
    recoveryContent = (
      <div
        className="auth-recovery-success"
        role="status"
      >
        <span aria-hidden="true">
          <BadgeCheckIcon size={24} />
        </span>
        <div>
          <h3>Check your inbox</h3>
          <p>{message}</p>
          <small>
            The link can be used once and expires after one hour.
          </small>
        </div>
        <Link
          className="button button--primary"
          to={loginPath}
        >
          <ArrowLeftIcon size={16} />
          Return to sign in
        </Link>
      </div>
    );
  }

  const content = (
    <AuthLayout
      eyebrow={eyebrow}
      title="A secure way back to your care workspace."
      description="Request a time-limited link, choose a new password, and continue coordinating care."
      trustItems={[
        "One-time recovery link",
        "One-hour expiry",
      ]}
      variant={variant}
      processItems={[
        "Request link",
        "Open email",
        "Choose password",
      ]}
      activeProcessIndex={0}
    >
      <Card className="auth-card auth-card--recovery">
        <div className="auth-card__account">
          <span aria-hidden="true">
            {accountIcon}
          </span>
          <div>
            <strong>{accountLabel}</strong>
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
          <div
            className="alert alert--error"
            role="alert"
          >
            {error}
          </div>
        )}

        {recoveryContent}

        {!message && (
          <Link
            className="auth-recovery-back"
            to={loginPath}
          >
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
    return (
      <CaregiverTheme>
        {content}
      </CaregiverTheme>
    );
  }

  return content;
}
