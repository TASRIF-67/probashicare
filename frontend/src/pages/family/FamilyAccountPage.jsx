import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "../../components/AppHeader.jsx";
import { Button } from "../../components/Button.jsx";
import {
  BadgeCheckIcon,
  SaveIcon,
  ShieldCheckIcon,
  UserIcon,
} from "../../components/Icons.jsx";
import { Input } from "../../components/Input.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { normalizeApiError } from "../../services/api.js";
import { authService } from "../../services/authService.js";

/**
 * Creates field/form errors from the standard API error shape.
 * @param {{message: string, details?: object|null}} normalizedError - API error.
 * @returns {object} Field messages plus a form-level message.
 * @sideEffects None.
 */
function createFormErrors(normalizedError) {
  const formErrors = {};

  if (normalizedError.details) {
    // `Object.entries` returns [fieldName, message] pairs for explicit copying.
    for (const entry of Object.entries(normalizedError.details)) {
      const fieldName = entry[0];
      const fieldMessage = entry[1];
      formErrors[fieldName] = fieldMessage;
    }
  }

  formErrors.form = normalizedError.message;
  return formErrors;
}

/**
 * Lets a signed-in Family owner update their name and verified email identity.
 * @returns {import("react").ReactElement} Account settings page.
 * @sideEffects May update identity, send verification email, and end session.
 */
export function FamilyAccountPage() {
  const {
    user,
    clearSession,
    refreshUser,
  } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    currentPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] =
    useState(false);

  const normalizedEnteredEmail =
    form.email.trim().toLowerCase();
  const emailChanged =
    normalizedEnteredEmail !== user.email;

  /**
   * Updates one controlled field and clears its previous error.
   * @param {import("react").ChangeEvent<HTMLInputElement>} event - Input event.
   * @returns {void}
   * @sideEffects Updates form and error state.
   */
  function handleChange(event) {
    const fieldName = event.target.name;
    const fieldValue = event.target.value;

    setForm(
      /**
       * Copies the form and replaces the field selected by its name.
       * @param {object} currentForm - Existing form values.
       * @returns {object} Updated form values.
       * @sideEffects None.
       */
      function updateAccountForm(currentForm) {
        return {
          ...currentForm,
          // Bracket notation uses the variable value as the property name.
          [fieldName]: fieldValue,
        };
      },
    );

    setErrors(
      /**
       * Clears only errors related to the field currently being edited.
       * @param {object} currentErrors - Existing error messages.
       * @returns {object} Updated error messages.
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
   * Saves account changes and redirects when re-verification is required.
   * @param {import("react").FormEvent<HTMLFormElement>} event - Submit event.
   * @returns {Promise<void>}
   * @sideEffects Calls API, refreshes/clears auth, toasts, and may navigate.
   */
  async function handleSubmit(event) {
    // Step 1: Keep React in control instead of refreshing the browser page.
    event.preventDefault();
    // Step 2: Enter saving state and clear old field errors.
    setIsSaving(true);
    setErrors({});

    try {
      // Step 3: Build only the fields accepted by the account API.
      const requestBody = {
        name: form.name,
        email: form.email,
        currentPassword: form.currentPassword,
      };
      // Step 4: Wait for password checks, account update, and possible email.
      const result =
        await authService.updateFamilyAccount(
          requestBody,
        );

      // Step 5a: Email change ends the session and moves to public login.
      if (result.requiresEmailVerification) {
        // The server already cleared its cookie. Remove the cached user before
        // replacing this protected route with the public login page.
        clearSession();
        navigate("/login", {
          replace: true,
          state: {
            verificationNotice: result.message,
            verificationEmail: result.email,
          },
        });
        return;
      }

      // Step 5b: Name-only change refreshes the authenticated user in context.
      await refreshUser();

      setForm(
        /**
         * Clears sensitive password text after a successful name-only update.
         * @param {object} currentForm - Existing form values.
         * @returns {object} Form without password text.
         * @sideEffects None.
         */
        function clearPassword(currentForm) {
          return {
            ...currentForm,
            currentPassword: "",
          };
        },
      );

      showToast(
        result.message,
        "success",
      );
    } catch (error) {
      // Step 6: Map backend validation details back to the form.
      const normalizedError =
        normalizeApiError(error);
      setErrors(
        createFormErrors(normalizedError),
      );
    } finally {
      // Step 7: Re-enable submission after success or failure.
      setIsSaving(false);
    }
  }

  return (
    <main>
      <AppHeader />
      <div className="feature-page family-account-page">
        <div className="family-account-heading">
          <span
            className="family-account-heading__icon"
            aria-hidden="true"
          >
            <UserIcon size={25} />
          </span>
          <div>
            <span className="eyebrow">
              Family owner account
            </span>
            <h1>Account information</h1>
            <p>
              Keep your family-space identity current and protect changes to
              the email used for signing in.
            </p>
          </div>
        </div>

        <div className="family-account-layout">
          <form
            className="form-section family-account-form"
            onSubmit={handleSubmit}
          >
            <div className="section-heading">
              <div>
                <h2>Personal details</h2>
                <p>Your name is shown as the family account owner.</p>
              </div>
              <span className="status-badge status-badge--approved">
                <BadgeCheckIcon size={15} />
                Verified
              </span>
            </div>

            {errors.form && (
              <div
                className="alert alert--error"
                role="alert"
              >
                {errors.form}
              </div>
            )}

            <div className="form-grid">
              <Input
                id="account-name"
                name="name"
                label="Account owner name"
                autoComplete="name"
                value={form.name}
                error={errors.name}
                onChange={handleChange}
                required
              />
              <Input
                id="account-email"
                name="email"
                type="email"
                label="Sign-in email"
                autoComplete="email"
                value={form.email}
                error={errors.email}
                hint="Changing this address requires email verification."
                onChange={handleChange}
                required
              />

              {emailChanged && (
                <Input
                  id="account-current-password"
                  name="currentPassword"
                  type="password"
                  label="Current password"
                  autoComplete="current-password"
                  value={form.currentPassword}
                  error={errors.currentPassword}
                  hint="Required to confirm that you own this account."
                  showPasswordToggle
                  onChange={handleChange}
                  required
                />
              )}
            </div>

            {emailChanged && (
              <div className="family-account-verification-note">
                <ShieldCheckIcon size={21} />
                <div>
                  <strong>A new verification is required</strong>
                  <p>
                    Saving signs you out and sends a one-time link to the new
                    address. You can sign in again after opening that link.
                  </p>
                </div>
              </div>
            )}

            <div className="form-actions">
              <Button
                type="submit"
                isLoading={isSaving}
                disabled={isSaving}
              >
                <SaveIcon size={18} />
                Save account
              </Button>
            </div>
          </form>

          <aside
            className="family-account-security"
            aria-label="Account security information"
          >
            <span aria-hidden="true">
              <ShieldCheckIcon size={24} />
            </span>
            <h2>Protected email changes</h2>
            <p>
              Your current password confirms the request. ProbashiCare then
              pauses account access until the new address is verified.
            </p>
            <ul>
              <li>The previous address cannot verify the change.</li>
              <li>The verification link expires after 24 hours.</li>
              <li>Name-only changes do not sign you out.</li>
            </ul>
          </aside>
        </div>
      </div>
    </main>
  );
}
