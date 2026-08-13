import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "../../components/AppHeader.jsx";
import { Button } from "../../components/Button.jsx";
import { Input } from "../../components/Input.jsx";
import {
  BadgeCheckIcon,
  SaveIcon,
  ShieldCheckIcon,
  UserIcon,
} from "../../components/Icons.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { normalizeApiError } from "../../services/api.js";
import { authService } from "../../services/authService.js";

/**
 * Lets a signed-in family owner update their name and verified email identity.
 * @param {void} _unused - This page accepts no props.
 * @returns {import("react").ReactElement} Family account settings form and security guidance.
 * @sideEffects Updates account data, may send a verification email, and may end the session.
 */
export function FamilyAccountPage() {
  const { user, clearSession, refreshUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    currentPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const emailChanged = form.email.trim().toLowerCase() !== user.email;

  /**
   * Updates one controlled account form field.
   * @param {import("react").ChangeEvent<HTMLInputElement>} event - Changed input event.
   * @returns {void}
   * @sideEffects Updates local form state and clears that field's previous error.
   */
  function handleChange(event) {
    const fieldName = event.target.name;
    const fieldValue = event.target.value;

    setForm(function updateAccountForm(current) {
      return {
        ...current,
        [fieldName]: fieldValue,
      };
    });

    setErrors(function clearChangedField(current) {
      return {
        ...current,
        [fieldName]: "",
        form: "",
      };
    });
  }

  /**
   * Saves account changes and redirects to sign-in when email verification is required.
   * @param {import("react").FormEvent<HTMLFormElement>} event - Account form submission.
   * @returns {Promise<void>}
   * @sideEffects Calls the account API, refreshes auth state, shows feedback, and may navigate.
   */
  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    setErrors({});

    try {
      const result = await authService.updateFamilyAccount({
        name: form.name,
        email: form.email,
        currentPassword: form.currentPassword,
      });

      if (result.requiresEmailVerification) {
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

      await refreshUser();
      setForm(function clearPassword(current) {
        return {
          ...current,
          currentPassword: "",
        };
      });
      showToast(result.message, "success");
    } catch (error) {
      const normalized = normalizeApiError(error);
      setErrors({
        ...(normalized.details || {}),
        form: normalized.message,
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main>
      <AppHeader />
      <div className="feature-page family-account-page">
        <div className="family-account-heading">
          <span className="family-account-heading__icon" aria-hidden="true">
            <UserIcon size={25} />
          </span>
          <div>
            <span className="eyebrow">Family owner account</span>
            <h1>Account information</h1>
            <p>
              Keep your family-space identity current and protect changes to
              the email used for signing in.
            </p>
          </div>
        </div>

        <div className="family-account-layout">
          <form className="form-section family-account-form" onSubmit={handleSubmit}>
            <div className="section-heading">
              <div>
                <h2>Personal details</h2>
                <p>Your name is shown as the family account owner.</p>
              </div>
              <span className="status-badge status-badge--approved">
                <BadgeCheckIcon size={15} /> Verified
              </span>
            </div>

            {errors.form && (
              <div className="alert alert--error" role="alert">
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
              <Button type="submit" isLoading={isSaving}>
                <SaveIcon size={18} /> Save account
              </Button>
            </div>
          </form>

          <aside className="family-account-security" aria-label="Account security information">
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
