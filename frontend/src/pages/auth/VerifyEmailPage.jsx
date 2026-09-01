import { useEffect, useState } from "react";
import {
  Link,
  useSearchParams,
} from "react-router-dom";
import { AuthLayout } from "../../components/AuthLayout.jsx";
import { Card } from "../../components/Card.jsx";
import {
  CaregiverTheme,
} from "../../components/caregiver/CaregiverTheme.jsx";
import { normalizeApiError } from "../../services/api.js";
import { authService } from "../../services/authService.js";

let currentVerificationToken = null;
let currentVerificationRequest = null;

/**
 * Performs verification and clears the shared request after it settles.
 * @param {string} token - Raw token from the URL.
 * @returns {Promise<{message: string}>} Verification API result.
 * @sideEffects Calls verification API and resets module-level request cache.
 */
async function performEmailVerification(token) {
  try {
    return await authService.verifyEmail(token);
  } finally {
    if (currentVerificationToken === token) {
      currentVerificationRequest = null;
    }
  }
}

/**
 * Reuses one pending request when React Strict Mode runs an effect twice.
 * @param {string} token - Raw token from the emailed link.
 * @returns {Promise<{message: string}>} Shared verification result.
 * @sideEffects Starts one request for a new/non-pending token.
 */
function requestEmailVerification(token) {
  const requestIsForAnotherToken =
    currentVerificationToken !== token;

  if (
    requestIsForAnotherToken ||
    !currentVerificationRequest
  ) {
    currentVerificationToken = token;
    currentVerificationRequest =
      performEmailVerification(token);
  }

  return currentVerificationRequest;
}

/**
 * Chooses the visible heading for a verification state.
 * @param {"loading"|"success"|"error"} status - Current request status.
 * @returns {string} User-facing status heading.
 * @sideEffects None.
 */
function getVerificationHeading(status) {
  if (status === "success") {
    return "You are verified";
  }

  if (status === "error") {
    return "Link not verified";
  }

  return "One moment";
}

/**
 * Consumes the one-time verification token from an emailed link.
 * @returns {import("react").ReactElement} Verification progress/result page.
 * @sideEffects Calls the verification API when a token is present.
 */
export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  // `URLSearchParams.get` returns the first value or null when absent.
  const token = searchParams.get("token");
  const mode = searchParams.get("mode");
  const isCaregiverMode = mode === "caregiver";
  const [state, setState] = useState({
    status: "loading",
    message: "Verifying your email address.",
  });

  useEffect(
    /**
     * Verifies the current query token and blocks late updates after unmount.
     * @returns {() => void} Cleanup for the activity flag.
     * @sideEffects May call the verification API and update local state.
     */
    function verifyTokenWhenUrlChanges() {
      let shouldUpdatePage = true;

      /**
       * Waits for the shared request and applies its final page state.
       * @returns {Promise<void>}
       * @sideEffects Calls verification and may update state.
       */
      async function verifyToken() {
        // Execution sequence:
        // 1. Submit the URL token through the verification helper.
        // 2. Store success or normalized failure only for the active effect.
        // 3. Let effect cleanup suppress late state updates.
        try {
          const data =
            await requestEmailVerification(token);

          if (shouldUpdatePage) {
            setState({
              status: "success",
              message: data.message,
            });
          }
        } catch (error) {
          if (shouldUpdatePage) {
            const normalizedError =
              normalizeApiError(error);

            setState({
              status: "error",
              message: normalizedError.message,
            });
          }
        }
      }

      if (!token) {
        setState({
          status: "error",
          message:
            "This verification link is incomplete.",
        });
      } else {
        void verifyToken();
      }

      /**
       * Prevents a finished request from updating an unmounted page.
       * @returns {void}
       * @sideEffects Changes the effect-local activity flag.
       */
      return function stopVerificationStateUpdates() {
        shouldUpdatePage = false;
      };
    },
    [token],
  );

  let trustItems;
  let variant = "family";
  let loginPath = "/login";

  if (isCaregiverMode) {
    trustItems = [
      "Private by design",
      "Verified care network",
    ];
    variant = "caregiver";
    loginPath = "/login?mode=caregiver";
  }

  const statusHeading =
    getVerificationHeading(state.status);

  const content = (
    <AuthLayout
      eyebrow="Account security"
      title="Email verification"
      description="We verify email ownership before allowing password-based sign-in."
      trustItems={trustItems}
      variant={variant}
      processItems={[
        "Account created",
        "Verify email",
        "Sign in",
      ]}
      activeProcessIndex={1}
    >
      <Card className="auth-card status-card">
        {state.status === "loading" && (
          <span className="spinner spinner--large" />
        )}
        <h2>{statusHeading}</h2>
        <p>{state.message}</p>

        {state.status !== "loading" && (
          <Link
            className="button button--primary"
            to={loginPath}
          >
            Go to sign in
          </Link>
        )}
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
