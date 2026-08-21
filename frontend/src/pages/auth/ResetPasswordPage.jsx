import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthLayout } from "../../components/AuthLayout.jsx";
import { Button } from "../../components/Button.jsx";
import { Card } from "../../components/Card.jsx";
import {
  BadgeCheckIcon,
  BriefcaseIcon,
  SaveIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "../../components/Icons.jsx";
import { Input } from "../../components/Input.jsx";
import { CaregiverTheme } from "../../components/caregiver/CaregiverTheme.jsx";
import { normalizeApiError } from "../../services/api.js";
import { authService } from "../../services/authService.js";

/**
 * Replaces an account password using the one-time token received by email.
 * @returns {import("react").ReactElement} Password-reset completion page.
 * @sideEffects Calls the reset API and consumes a valid recovery token.
 */
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const isCaregiverMode = searchParams.get("mode") === "caregiver";
  const loginPath = isCaregiverMode ? "/login?mode=caregiver" : "/login";
  const [form, setForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  /**
   * Updates one controlled password field and clears its old validation error.
   * @param {import("react").ChangeEvent<HTMLInputElement>} event - Password input event.
   * @returns {void}
   * @sideEffects Updates local form and error state.
   */
  function handleChange(event) {
    const fieldName = event.target.name;
    const fieldValue = event.target.value;

    setForm(function updateResetForm(currentForm) {
      return {
        ...currentForm,
        [fieldName]: fieldValue,
      };
    });
    setErrors(function clearChangedField(currentErrors) {
      return {
        ...currentErrors,
        [fieldName]: "",
        form: "",
      };
    });
  }

  /**
   * Validates matching passwords and consumes the email reset token.
   * @param {import("react").FormEvent<HTMLFormElement>} event - Form submission event.
   * @returns {Promise<void>} Resolves after validation and the API request finish.
   * @sideEffects Calls the authentication API and updates visible page state.
   */
  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};

    if (form.password.length < 8) {
      nextErrors.password = "Use at least 8 characters.";
    }

    if (form.confirmPassword !== form.password) {
      nextErrors.confirmPassword = "Passwords must match.";
    }

    if (!token) {
      nextErrors.form = "This reset link is incomplete. Request a new link.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const result = await authService.resetPassword({
        token,
        password: form.password,
        confirmPassword: form.confirmPassword,
      });
      setMessage(result.message);
    } catch (requestError) {
      const normalizedError = normalizeApiError(requestError);
      setErrors({
        ...normalizedError.details,
        form: normalizedError.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const content = (
    <AuthLayout
      eyebrow={isCaregiverMode ? "Caregiver password reset" : "Family password reset"}
      title="Restore access without losing your care workspace."
      description="Choose a new password for the account connected to this secure one-time link."
      trustItems={["Encrypted password storage", "One-time reset token"]}
      variant={isCaregiverMode ? "caregiver" : "family"}
      processItems={["Request link", "Open email", "Choose password"]}
      activeProcessIndex={2}
    >
      <Card className="auth-card auth-card--recovery">
        <div className="auth-card__account">
          <span aria-hidden="true">
            {isCaregiverMode ? <BriefcaseIcon /> : <UsersIcon />}
          </span>
          <div>
            <strong>Secure password reset</strong>
          </div>
        </div>

        <div className="auth-card__heading">
          <h2>Choose a new password</h2>
          <p>Use at least eight characters that you do not use elsewhere.</p>
        </div>

        {errors.form && (
          <div className="alert alert--error" role="alert">
            {errors.form}
          </div>
        )}

        {message ? (
          <div className="auth-recovery-success" role="status">
            <span aria-hidden="true">
              <BadgeCheckIcon size={24} />
            </span>
            <div>
              <h3>Password updated</h3>
              <p>{message}</p>
            </div>
            <Link className="button button--primary" to={loginPath}>
              Continue to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <Input
              id="new-password"
              name="password"
              type="password"
              label="New password"
              placeholder="At least 8 characters"
              showPasswordToggle
              autoComplete="new-password"
              minLength="8"
              value={form.password}
              onChange={handleChange}
              error={errors.password}
              required
            />
            <Input
              id="confirm-new-password"
              name="confirmPassword"
              type="password"
              label="Confirm new password"
              placeholder="Re-enter your new password"
              showPasswordToggle
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={handleChange}
              error={errors.confirmPassword}
              required
            />
            <Button type="submit" isLoading={isSubmitting}>
              <SaveIcon size={17} />
              Update password
            </Button>
          </form>
        )}

        <div className="auth-card__assurance">
          <ShieldCheckIcon size={15} />
          The emailed link expires after one hour and cannot be reused.
        </div>
      </Card>
    </AuthLayout>
  );

  if (isCaregiverMode) {
    return <CaregiverTheme>{content}</CaregiverTheme>;
  }

  return content;
}
