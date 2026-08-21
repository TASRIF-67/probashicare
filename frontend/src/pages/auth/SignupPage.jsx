import { GoogleLogin } from "@react-oauth/google";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AuthLayout } from "../../components/AuthLayout.jsx";
import { Button } from "../../components/Button.jsx";
import { Card } from "../../components/Card.jsx";
import {
  BadgeCheckIcon,
  BriefcaseIcon,
  ShieldCheckIcon,
  UserPlusIcon,
  UsersIcon,
} from "../../components/Icons.jsx";
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
    eyebrow: "Create your care space",
    title: "Bring your family care into one clear place.",
    description: "Start with your account, verify your email, and add the people whose care you want to coordinate.",
    trustItems: ["Authorized family access", "Private health context"],
  },
  caregiver: {
    eyebrow: "Join the care network",
    title: "Make dependable care visible to families.",
    description: "Create your account first, then complete the professional profile reviewed by the ProbashiCare team.",
    trustItems: ["Administrator review", "Verified care network"],
  },
};

/**
 * Renders the Family and Caregiver signup experience.
 * @param {object} props - Signup route properties.
 * @param {"family"|"caregiver"} [props.initialMode] - Account type selected by the route.
 * @returns {import("react").ReactElement} Mode-aware signup form with Family-only Google signup.
 * @sideEffects Changes the accent, creates accounts, sends verification email, or starts a Family Google session.
 */
export function SignupPage({ initialMode = "family" }) {
  const [mode, setMode] = useState(initialMode);
  const [familyForm, setFamilyForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [caregiverForm, setCaregiverForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [errorsByMode, setErrorsByMode] = useState({
    family: {},
    caregiver: {},
  });
  const [messagesByMode, setMessagesByMode] = useState({
    family: "",
    caregiver: "",
  });
  const [resendStateByMode, setResendStateByMode] = useState({
    family: {
      isSending: false,
      message: "",
      error: "",
    },
    caregiver: {
      isSending: false,
      message: "",
      error: "",
    },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { loginWithGoogle } = useAuth();
  const { setAccentMode } = useTheme();
  const { showToast } = useToast();
  const redirectAfterLogin = useAuthRedirect();

  useEffect(() => {
    setMode(initialMode);
    setAccentMode(initialMode);

    return function restoreFamilyAccent() {
      setAccentMode("family");
    };
  }, [initialMode, setAccentMode]);

  /**
   * Changes signup mode without discarding either form.
   * @param {"family"|"caregiver"} nextMode - Newly selected account type.
   * @returns {void}
   * @sideEffects Updates page state and the shared theme accent.
   */
  function handleModeChange(nextMode) {
    setMode(nextMode);
    setAccentMode(nextMode);
  }

  /**
   * Updates one field in the active signup form and clears its validation error.
   * @param {import("react").ChangeEvent<HTMLInputElement>} event - Changed signup input.
   * @returns {void}
   * @sideEffects Updates the active form and error state.
   */
  function handleChange(event) {
    const fieldName = event.target.name;
    const fieldValue = event.target.value;

    if (mode === "family") {
      setFamilyForm(function updateFamilyForm(current) {
        return {
          ...current,
          [fieldName]: fieldValue,
        };
      });
    } else {
      setCaregiverForm(function updateCaregiverForm(current) {
        return {
          ...current,
          [fieldName]: fieldValue,
        };
      });
    }

    setErrorsByMode(function clearFieldError(current) {
      return {
        ...current,
        [mode]: {
          ...current[mode],
          [fieldName]: undefined,
          form: undefined,
        },
      };
    });
  }

  /**
   * Creates the active email and password account type.
   * @param {import("react").FormEvent<HTMLFormElement>} event - Signup form submission.
   * @returns {Promise<void>} Resolves after the signup request finishes.
   * @sideEffects Calls the Family or Caregiver signup API and triggers verification delivery.
   */
  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);

    setErrorsByMode(function clearCurrentErrors(current) {
      return {
        ...current,
        [mode]: {},
      };
    });

    try {
      let data;

      if (mode === "family") {
        data = await authService.signup(familyForm);
      } else {
        data = await authService.caregiverSignup(caregiverForm);
      }

      setMessagesByMode(function storeSuccessMessage(current) {
        return {
          ...current,
          [mode]: data.message,
        };
      });
      setResendStateByMode(function clearOldResendState(current) {
        return {
          ...current,
          [mode]: {
            isSending: false,
            message: "",
            error: "",
          },
        };
      });
    } catch (requestError) {
      const normalizedError = normalizeApiError(requestError);

      setErrorsByMode(function storeRequestErrors(current) {
        return {
          ...current,
          [mode]: {
            ...(normalizedError.details || {}),
            form: normalizedError.message,
          },
        };
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  /**
   * Creates or signs into a Family account through Google.
   * @param {{credential?: string}} result - Google Identity Services response.
   * @returns {Promise<void>} Resolves after the Google authentication request finishes.
   * @sideEffects Calls Family Google authentication, shows feedback, and redirects.
   */
  async function handleGoogleSuccess(result) {
    if (!result.credential) {
      return;
    }

    try {
      const user = await loginWithGoogle(result.credential);
      showToast("Family account ready.", "success");
      redirectAfterLogin(user);
    } catch (requestError) {
      const normalizedError = normalizeApiError(requestError);

      setErrorsByMode(function storeGoogleError(current) {
        return {
          ...current,
          family: {
            form: normalizedError.message,
          },
        };
      });
    }
  }

  /**
   * Shows a stable message when Google signup cannot finish.
   * @returns {void}
   * @sideEffects Updates the Family signup error state.
   */
  function handleGoogleError() {
    setErrorsByMode(function storeGoogleDialogError(current) {
      return {
        ...current,
        family: {
          form: "Google sign-up was not completed.",
        },
      };
    });
  }

  /**
   * Requests a replacement verification email for the completed signup mode.
   * @returns {Promise<void>}
   * @sideEffects Calls the resend API and updates visible delivery feedback.
   */
  async function handleResendVerification() {
    const activeForm = mode === "family"
      ? familyForm
      : caregiverForm;
    const email = activeForm.email.trim();

    setResendStateByMode(function markResendBusy(current) {
      return {
        ...current,
        [mode]: {
          isSending: true,
          message: "",
          error: "",
        },
      };
    });

    try {
      const result = await authService.resendVerification(email);

      setResendStateByMode(function showResendSuccess(current) {
        return {
          ...current,
          [mode]: {
            isSending: false,
            message: result.message,
            error: "",
          },
        };
      });
    } catch (requestError) {
      const normalizedError = normalizeApiError(requestError);

      setResendStateByMode(function showResendError(current) {
        return {
          ...current,
          [mode]: {
            isSending: false,
            message: "",
            error: normalizedError.message,
          },
        };
      });
    }
  }

  const copy = SIGNUP_COPY[mode];
  const errors = errorsByMode[mode];
  const message = messagesByMode[mode];
  const resendState = resendStateByMode[mode];
  const isFamilyMode = mode === "family";
  const loginPath = isFamilyMode ? "/login" : "/login?mode=caregiver";
  const verificationEmail = isFamilyMode
    ? familyForm.email
    : caregiverForm.email;

  return (
    <AuthLayout
      {...copy}
      variant={mode}
      processItems={isFamilyMode
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
      <Card className="auth-card auth-card--signup signup-card">
        <div className="auth-card__account">
          <span aria-hidden="true">
            {isFamilyMode ? <UsersIcon /> : <BriefcaseIcon />}
          </span>
          <div>
            <strong>{isFamilyMode ? "Family account" : "Caregiver account"}</strong>
            <small>
              {isFamilyMode
                ? "Create a private workspace for your family."
                : "Begin an administrator-reviewed application."}
            </small>
          </div>
        </div>

        <div className="auth-card__heading">
          <h2>{isFamilyMode ? "Create your account" : "Create caregiver account"}</h2>
          <p>
            {isFamilyMode
              ? "You can add elderly profiles after verifying your email."
              : "You will add qualifications and availability after signing in."}
          </p>
        </div>

        {errors.form && (
          <div className="alert alert--error" role="alert">
            {errors.form}
          </div>
        )}

        {message ? (
          <div className="success-panel auth-signup-success" role="status">
            <BadgeCheckIcon size={28} />
            <div>
              <h3>Check your inbox</h3>
              <p>{message}</p>
              <p className="auth-verification-recipient">
                Verification address:
                {" "}
                <strong>{verificationEmail}</strong>
              </p>
            </div>
            {resendState.message && (
              <p
                className="auth-resend-feedback auth-resend-feedback--success"
                role="status"
              >
                {resendState.message}
              </p>
            )}
            {resendState.error && (
              <p
                className="auth-resend-feedback auth-resend-feedback--error"
                role="alert"
              >
                {resendState.error}
              </p>
            )}
            <div className="auth-verification-actions">
              <Button
                variant="secondary"
                isLoading={resendState.isSending}
                onClick={handleResendVerification}
              >
                Resend verification email
              </Button>
              <Link className="button button--primary" to={loginPath}>
                Return to sign in
              </Link>
            </div>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit}>
              {isFamilyMode ? (
                <>
                  <Input
                    id="family-name"
                    name="name"
                    label="Your name"
                    placeholder="e.g. Tash Ahmed"
                    autoComplete="name"
                    value={familyForm.name}
                    onChange={handleChange}
                    error={errors.name}
                    required
                  />
                  <Input
                    id="family-email"
                    name="email"
                    type="email"
                    label="Email address"
                    placeholder="you@example.com"
                    autoComplete="email"
                    value={familyForm.email}
                    onChange={handleChange}
                    error={errors.email}
                    required
                  />
                  <Input
                    id="family-password"
                    name="password"
                    type="password"
                    label="Password"
                    placeholder="At least 8 characters"
                    showPasswordToggle
                    autoComplete="new-password"
                    minLength="8"
                    value={familyForm.password}
                    onChange={handleChange}
                    error={errors.password}
                    required
                  />
                  <small className="field-hint">
                    Use at least 8 characters.
                  </small>
                </>
              ) : (
                <>
                  <Input
                    id="caregiver-name"
                    name="name"
                    label="Full name"
                    placeholder="e.g. Rina Akter"
                    autoComplete="name"
                    value={caregiverForm.name}
                    onChange={handleChange}
                    error={errors.name}
                    required
                  />
                  <Input
                    id="caregiver-email"
                    name="email"
                    type="email"
                    label="Email address"
                    placeholder="you@example.com"
                    autoComplete="email"
                    value={caregiverForm.email}
                    onChange={handleChange}
                    error={errors.email}
                    required
                  />
                  <Input
                    id="caregiver-phone-signup"
                    name="phone"
                    type="tel"
                    label="Phone number"
                    placeholder="e.g. 01712 345678"
                    autoComplete="tel"
                    value={caregiverForm.phone}
                    onChange={handleChange}
                    error={errors.phone}
                    required
                  />
                  <Input
                    id="caregiver-password"
                    name="password"
                    type="password"
                    label="Password"
                    placeholder="At least 8 characters"
                    showPasswordToggle
                    autoComplete="new-password"
                    minLength="8"
                    value={caregiverForm.password}
                    onChange={handleChange}
                    error={errors.password}
                    required
                  />
                  <Input
                    id="caregiver-confirm-password"
                    name="confirmPassword"
                    type="password"
                    label="Confirm password"
                    placeholder="Re-enter your password"
                    showPasswordToggle
                    autoComplete="new-password"
                    value={caregiverForm.confirmPassword}
                    onChange={handleChange}
                    error={errors.confirmPassword}
                    required
                  />
                </>
              )}

              <Button type="submit" isLoading={isSubmitting}>
                {isFamilyMode ? (
                  <>
                    <UserPlusIcon size={18} />
                    Create family account
                  </>
                ) : (
                  <>
                    <BriefcaseIcon size={18} />
                    Register and apply
                  </>
                )}
              </Button>
            </form>

            {isFamilyMode && (
              <>
                <div className="divider">
                  <span>or continue with</span>
                </div>
                <div className="google-button">
                  <GoogleLogin
                    text="signup_with"
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                  />
                </div>
              </>
            )}

            <p className="auth-card__footer">
              Already have an account? <Link to={loginPath}>Sign in</Link>
            </p>

            <div className="auth-card__assurance">
              <ShieldCheckIcon size={15} />
              Verification protects access to private care information.
            </div>
          </>
        )}
      </Card>
    </AuthLayout>
  );
}
