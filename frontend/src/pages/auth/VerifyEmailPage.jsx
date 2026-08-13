import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthLayout } from "../../components/AuthLayout.jsx";
import { Card } from "../../components/Card.jsx";
import { normalizeApiError } from "../../services/api.js";
import { authService } from "../../services/authService.js";
import { CaregiverTheme } from "../../components/caregiver/CaregiverTheme.jsx";

let currentVerificationToken = null;
let currentVerificationRequest = null;

/**
 * Reuses the same verification request when React Strict Mode runs an effect twice.
 * @param {string} token - One-time token read from the emailed verification link.
 * @returns {Promise<{message: string}>} Shared verification API result.
 * @sideEffects May call the verification endpoint once for a new token.
 */
function requestEmailVerification(token) {
  if (currentVerificationToken !== token || !currentVerificationRequest) {
    currentVerificationToken = token;
    currentVerificationRequest = authService.verifyEmail(token);
  }

  return currentVerificationRequest;
}

/**
 * Consumes the one-time verification token from an emailed link.
 * @param {void} _unused - This page accepts no props.
 * @returns {import("react").ReactElement} Verification progress and result.
 * @sideEffects Calls the verification API once when a token is present.
 */
export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const isCaregiverMode = searchParams.get("mode") === "caregiver";
  const [state, setState] = useState({
    status: "loading",
    message: "Verifying your email address.",
  });

  useEffect(() => {
    let shouldUpdatePage = true;

    /**
     * Waits for the shared verification request and displays its final result.
     * @param {void} _unused - This function accepts no arguments.
     * @returns {Promise<void>}
     * @sideEffects Updates this page while it remains mounted.
     */
    async function verifyToken() {
      try {
        const data = await requestEmailVerification(token);

        if (shouldUpdatePage) {
          setState({
            status: "success",
            message: data.message,
          });
        }
      } catch (error) {
        if (shouldUpdatePage) {
          setState({
            status: "error",
            message: normalizeApiError(error).message,
          });
        }
      }
    }

    if (!token) {
      setState({
        status: "error",
        message: "This verification link is incomplete.",
      });
    } else {
      void verifyToken();
    }

    return () => {
      shouldUpdatePage = false;
    };
  }, [token]);

  const content = (
    <AuthLayout
      eyebrow="Account security"
      title="Email verification"
      description="We verify email ownership before allowing password-based sign-in."
      trustItems={isCaregiverMode ? ["Private by design", "Verified care network"] : undefined}
      variant={isCaregiverMode ? "caregiver" : "family"}
      processItems={["Account created", "Verify email", "Sign in"]}
      activeProcessIndex={1}
    >
      <Card className="auth-card status-card">
        {state.status === "loading" && (
          <span className="spinner spinner--large" />
        )}
        <h2>
          {state.status === "success"
            ? "You are verified"
            : state.status === "error"
              ? "Link not verified"
              : "One moment"}
        </h2>
        <p>{state.message}</p>
        {state.status !== "loading" && (
          <Link
            className="button button--primary"
            to={isCaregiverMode ? "/login?mode=caregiver" : "/login"}
          >
            Go to sign in
          </Link>
        )}
      </Card>
    </AuthLayout>
  );

  if (isCaregiverMode) {
    return <CaregiverTheme>{content}</CaregiverTheme>;
  }

  return content;
}
