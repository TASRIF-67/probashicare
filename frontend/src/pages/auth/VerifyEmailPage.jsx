import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthLayout } from "../../components/AuthLayout.jsx";
import { Card } from "../../components/Card.jsx";
import { normalizeApiError } from "../../services/api.js";
import { authService } from "../../services/authService.js";
import { CaregiverTheme } from "../../components/caregiver/CaregiverTheme.jsx";

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
  const [state, setState] = useState({ status: "loading", message: "Verifying your email address." });

  useEffect(() => {
    if (!token) {
      setState({ status: "error", message: "This verification link is incomplete." });
      return;
    }
    authService
      .verifyEmail(token)
      .then((data) => setState({ status: "success", message: data.message }))
      .catch((error) => setState({ status: "error", message: normalizeApiError(error).message }));
  }, [token]);

  const content = (
    <AuthLayout eyebrow="Account security" title="Email verification" description="We verify email ownership before allowing password-based sign-in." trustItems={isCaregiverMode ? ["Private by design", "Verified care network"] : undefined}>
      <Card className="auth-card status-card">
        {state.status === "loading" && <span className="spinner spinner--large" />}
        <h2>{state.status === "success" ? "You are verified" : state.status === "error" ? "Link not verified" : "One moment"}</h2>
        <p>{state.message}</p>
        {state.status !== "loading" && <Link className="button button--primary" to={isCaregiverMode ? "/login?mode=caregiver" : "/login"}>Go to sign in</Link>}
      </Card>
    </AuthLayout>
  );
  return isCaregiverMode ? <CaregiverTheme>{content}</CaregiverTheme> : content;
}
