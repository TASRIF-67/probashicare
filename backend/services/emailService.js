import nodemailer from "nodemailer";
import { env } from "../config/env.js";

let transporter = null;

/**
 * Converts plain text into safe HTML before inserting it into an email.
 * @param {string} value - Plain text such as a display name or URL.
 * @returns {string} Text with HTML control characters escaped.
 * @sideEffects None.
 */
function escapeHtml(value) {
  let safeValue = "";

  // `String` normalizes values before `for...of` reads one character at a time.
  for (const character of String(value)) {
    if (character === "&") {
      safeValue += "&amp;";
    } else if (character === "<") {
      safeValue += "&lt;";
    } else if (character === ">") {
      safeValue += "&gt;";
    } else if (character === '"') {
      safeValue += "&quot;";
    } else if (character === "'") {
      safeValue += "&#039;";
    } else {
      safeValue += character;
    }
  }

  return safeValue;
}

/**
 * Checks whether at least one required SMTP setting is missing.
 * @returns {boolean} True when SMTP delivery is not fully configured.
 * @sideEffects None.
 */
function mailConfigurationIsMissing() {
  if (!env.smtpHost) {
    return true;
  }

  if (!env.smtpUser) {
    return true;
  }

  if (!env.smtpPass) {
    return true;
  }

  return false;
}

/**
 * Confirms that every value required for SMTP delivery is configured.
 * @returns {void}
 * @sideEffects Throws when mail configuration is incomplete.
 */
function requireMailConfiguration() {
  if (mailConfigurationIsMissing()) {
    throw new Error(
      "SMTP_HOST, SMTP_USER, and SMTP_PASS are required to send email.",
    );
  }
}

/**
 * Determines whether local development may print a one-time link.
 * @returns {boolean} True only in development with incomplete SMTP settings.
 * @sideEffects None.
 */
function useDevelopmentConsoleDelivery() {
  return env.nodeEnv === "development" && mailConfigurationIsMissing();
}

/**
 * Lazily creates and reuses the configured SMTP transport.
 * @returns {import("nodemailer").Transporter} Reusable mail transporter.
 * @sideEffects Creates a Nodemailer transport object on first use.
 */
function getTransporter() {
  if (!transporter) {
    requireMailConfiguration();

    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      // Port 465 starts with TLS. Port 587 upgrades through STARTTLS.
      secure: env.smtpPort === 465,
      auth: {
        user: env.smtpUser,
        pass: env.smtpPass,
      },
    });
  }

  return transporter;
}

/**
 * Prints one development-only account link when SMTP is unavailable.
 * @param {string} label - Link purpose.
 * @param {string} recipient - Target email.
 * @param {string} url - One-time frontend URL.
 * @returns {{messageId: string}} Development delivery marker.
 * @sideEffects Writes the sensitive one-time link to the local backend console.
 */
function printDevelopmentLink(label, recipient, url) {
  console.log(
    "Development " +
      label +
      " link for " +
      recipient +
      ": " +
      url,
  );

  return {
    messageId: "development-console-delivery",
  };
}

/**
 * Checks SMTP connection and credentials without sending a message.
 * @returns {Promise<boolean>} Provider connection result.
 * @sideEffects Opens a temporary SMTP connection.
 */
export async function verifyEmailTransport() {
  requireMailConfiguration();
  return getTransporter().verify();
}

/**
 * Sends a Family or Caregiver account-verification link.
 * @param {{to: string, name: string, verificationUrl: string}} message - Mail values.
 * @returns {Promise<{messageId: string}>} Provider or development message ID.
 * @sideEffects Sends SMTP email or prints a local development link.
 */
export async function sendVerificationEmail({
  to,
  name,
  verificationUrl,
}) {
  // Execution sequence:
  // 1. Use console delivery only when explicitly enabled for development.
  // 2. Escape user text and construct the verification message.
  // 3. Send through the shared configured Nodemailer transporter.
  if (useDevelopmentConsoleDelivery()) {
    return printDevelopmentLink(
      "verification",
      to,
      verificationUrl,
    );
  }

  requireMailConfiguration();

  const safeName = escapeHtml(name);
  const safeVerificationUrl = escapeHtml(verificationUrl);
  const text =
    "Hello " +
    name +
    ", verify your ProbashiCare account: " +
    verificationUrl;
  const html =
    "<p>Hello " +
    safeName +
    ",</p>" +
    "<p>Verify your ProbashiCare account by opening this link:</p>" +
    '<p><a href="' +
    safeVerificationUrl +
    '">Verify email address</a></p>' +
    "<p>This link expires in 24 hours.</p>" +
    "<p>If you did not create this account, you can ignore this email.</p>";

  const result = await getTransporter().sendMail({
    from: env.mailFrom,
    to,
    subject: "Verify your ProbashiCare account",
    text,
    html,
  });

  return {
    messageId: result.messageId,
  };
}

/**
 * Sends a one-time ProbashiCare password-reset link.
 * @param {{to: string, name: string, resetUrl: string}} message - Mail values.
 * @returns {Promise<{messageId: string}>} Provider or development message ID.
 * @sideEffects Sends SMTP email or prints a local development link.
 */
export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
}) {
  if (useDevelopmentConsoleDelivery()) {
    return printDevelopmentLink(
      "password-reset",
      to,
      resetUrl,
    );
  }

  requireMailConfiguration();

  const safeName = escapeHtml(name);
  const safeResetUrl = escapeHtml(resetUrl);
  const text =
    "Hello " +
    name +
    ", reset your ProbashiCare password: " +
    resetUrl +
    ". This link expires in one hour.";
  const html =
    "<p>Hello " +
    safeName +
    ",</p>" +
    "<p>We received a request to reset your ProbashiCare password.</p>" +
    '<p><a href="' +
    safeResetUrl +
    '">Reset password</a></p>' +
    "<p>This one-time link expires in one hour.</p>" +
    "<p>If you did not request this change, you can safely ignore this email.</p>";

  const result = await getTransporter().sendMail({
    from: env.mailFrom,
    to,
    subject: "Reset your ProbashiCare password",
    text,
    html,
  });

  return {
    messageId: result.messageId,
  };
}
