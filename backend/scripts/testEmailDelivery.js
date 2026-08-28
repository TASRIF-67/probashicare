import { env, validateEnvironment } from "../config/env.js";
import {
  sendVerificationEmail,
  verifyEmailTransport,
} from "../services/emailService.js";

/**
 * Verifies SMTP login and sends one real test message to a chosen address.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {Promise<void>}
 * @sideEffects Connects to SMTP and sends one test email to TEST_EMAIL_TO or SMTP_USER.
 */
async function testEmailDelivery() {
  validateEnvironment(["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "MAIL_FROM"]);

  const recipient = process.env.TEST_EMAIL_TO || env.smtpUser;
  const testVerificationUrl =
    (env.clientUrl || "http://localhost:5173") +
    "/verify-email?token=test-delivery-only";

  await verifyEmailTransport();
  console.log("SMTP connection and authentication succeeded.");

  const result = await sendVerificationEmail({
    to: recipient,
    name: "ProbashiCare tester",
    verificationUrl: testVerificationUrl,
  });

  console.log("Test email accepted by the SMTP provider.");
  console.log("Provider message ID:", result.messageId);
}

/**
 * Reports a failed SMTP test and sets a non-zero process exit code.
 * @param {Error} error - Connection or message-delivery failure.
 * @returns {void}
 * @sideEffects Writes to stderr and changes process.exitCode.
 */
function handleEmailTestFailure(error) {
  console.error("Email delivery test failed:", error.message);
  process.exitCode = 1;
}

// `catch` runs only when the Promise returned by testEmailDelivery rejects.
testEmailDelivery().catch(handleEmailTestFailure);
