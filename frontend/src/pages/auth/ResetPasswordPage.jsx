import { useState } from "react";
import {
  Link,
  useSearchParams,
} from "react-router-dom";
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
import {
  CaregiverTheme,
} from "../../components/caregiver/CaregiverTheme.jsx";
import { normalizeApiError } from "../../services/api.js";
import { authService } from "../../services/authService.js";

/**
 * Copies standard API field errors into one form-error object.
 * @param {{message: string, details?: object|null}} normalizedError - Error.
 * @returns {object} Field and form messages.
 * @sideEffects None.
 */
function createResetErrors(normalizedError) {
  const resetErrors = {};

  if (normalizedError.details) {
    for (const entry of Object.entries(normalizedError.details)) {
      resetErrors[entry[0]] = entry[1];
    }
  }

  resetErrors.form = normalizedError.message;
  return resetErrors;
}

/**
 * Replaces an account password using an emailed one-time token.
 * @returns {import("react").ReactElement} Password-reset page.
 * @sideEffects Calls reset API and consumes a valid recovery token.
 */
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const isCaregiverMode =
    searchParams.get("mode") === "caregiver";
  const [form, setForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] =
    useState(false);
  const [message, setMessage] = useState("");

  let loginPath = "/login";
  let eyebrow = "Family password reset";
  let accountIcon = <UsersIcon />;
  let variant = "family";

  if (isCaregiverMode) {
    loginPath = "/login?mode=caregiver";
    eyebrow = "Caregiver password reset";
    accountIcon = <BriefcaseIcon />;
    variant = "caregiver";
  }

  /**
   * Updates one controlled password field and clears its previous error.
   * @param {import("react").ChangeEvent<HTMLInputElement>} event - Input event.
   * @returns {void}
   * @sideEffects Updates local form/error state.
   */
  function handleChange(event) {
    const fieldName = event.target.name;
    const fieldValue = event.target.value;

    setForm(
      /**
       * Replaces one dynamic form field by name.
       * @param {object} currentForm - Existing password values.
       * @returns {object} Updated password values.
       * @sideEffects None.
       */
      function updateResetForm(currentForm) {
        return {
          ...currentForm,
          [fieldName]: fieldValue,
        };
      },
    );

    setErrors(
      /**
       * Clears errors related to the edited field.
       * @param {object} currentErrors - Existing messages.
       * @returns {object} Updated messages.
       * @sideEffects None.
       */
      function clearChangedField(currentErrors) {
        return {
          ...currentErrors,
          [fieldName]: "",
          form: "",
        };
      },
    );
  }

  /**
   * Validates matching passwords and consumes the reset token.
   * @param {import("react").FormEvent<HTMLFormElement>} event - Submit event.
   * @returns {Promise<void>}
   * @sideEffects Calls API and updates visible page state.
   */
  async function handleSubmit(event) {
    // Execution sequence:
    // 1. Prevent reload and validate both password fields locally.
    // 2. Stop on field errors; otherwise submit token and replacement password.
    // 3. Show the outcome and always restore the submit control.
    event.preventDefault();
    const nextErrors = {};

    if (form.password.length < 8) {
      nextErrors.password =
        "Use at least 8 characters.";
    }

    if (
      form.confirmPassword !== form.password
    ) {
      nextErrors.confirmPassword =
        "Passwords must match.";
    }

    if (!token) {
      nextErrors.form =
        "This reset link is incomplete. Request a new link.";
    }

    // `Object.keys` returns the collected error field names.
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const requestBody = {
        token,
        password: form.password,
        confirmPassword: form.confirmPassword,
      };
      const result =
        await authService.resetPassword(
          requestBody,
        );
      setMessage(result.message);
    } catch (requestError) {
      const normalizedError =
        normalizeApiError(requestError);
      setErrors(
        createResetErrors(normalizedError),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  let resetFormContent = (
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
      <Button
        type="submit"
        isLoading={isSubmitting}
        disabled={isSubmitting}
      >
        <SaveIcon size={17} />
        Update password
      </Button>
    </form>
  );

  if (message) {
    resetFormContent = (
      <div
        className="auth-recovery-success"
        role="status"
      >
        <span aria-hidden="true">
          <BadgeCheckIcon size={24} />
        </span>
        <div>
          <h3>Password updated</h3>
          <p>{message}</p>
        </div>
        <Link
          className="button button--primary"
          to={loginPath}
        >
          Continue to sign in
        </Link>
      </div>
    );
  }

  const content = (
    <AuthLayout
      eyebrow={eyebrow}
      title="Restore access without losing your care workspace."
      description="Choose a new password for the account connected to this secure one-time link."
      trustItems={[
        "Encrypted password storage",
        "One-time reset token",
      ]}
      variant={variant}
      processItems={[
        "Request link",
        "Open email",
        "Choose password",
      ]}
      activeProcessIndex={2}
    >
      <Card className="auth-card auth-card--recovery">
        <div className="auth-card__account">
          <span aria-hidden="true">
            {accountIcon}
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
          <div
            className="alert alert--error"
            role="alert"
          >
            {errors.form}
          </div>
        )}

        {resetFormContent}

        <div className="auth-card__assurance">
          <ShieldCheckIcon size={15} />
          The emailed link expires after one hour and cannot be reused.
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
