import nodemailer from "nodemailer";
import { env } from "../config/env.js";

let transporter;

/**
 * Converts plain text into safe HTML before it is inserted into an email.
 * @param {string} value - Plain text such as a user's display name.
 * @returns {string} Text with HTML control characters escaped.
 * @sideEffects None.
 */
function escapeHtml(value) {
  let safeValue = "";

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
 * Confirms that every value required for SMTP delivery is configured.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {void}
 * @sideEffects Throws an Error when the mail configuration is incomplete.
 */
function requireMailConfiguration() {
  if (!env.smtpHost || !env.smtpUser || !env.smtpPass) {
    throw new Error(
      "SMTP_HOST, SMTP_USER, and SMTP_PASS are required to send email.",
    );
  }
}

/**
 * Lazily creates the SMTP transport so startup does not open unnecessary connections.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {import("nodemailer").Transporter} Configured reusable mail transporter.
 * @sideEffects Creates an SMTP transport object on first use.
 */
function getTransporter() {
  if (!transporter) {
    requireMailConfiguration();

    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
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
 * Checks the SMTP connection and credentials without sending a message.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {Promise<boolean>} True when the SMTP provider accepts the connection and login.
 * @sideEffects Opens a temporary connection to the configured SMTP server.
 */
export async function verifyEmailTransport() {
  requireMailConfiguration();
  return getTransporter().verify();
}

/**
 * Sends the shared family or caregiver account verification link.
 * @param {{to: string, name: string, verificationUrl: string}} message - Recipient details and one-time link.
 * @returns {Promise<{messageId: string}>} Mail provider message identifier.
 * @sideEffects Sends an email through the configured SMTP provider.
 */
export async function sendVerificationEmail({ to, name, verificationUrl }) {
  if (env.nodeEnv === "development" && (!env.smtpHost || !env.smtpUser || !env.smtpPass)) {
    console.log(`Development verification link for ${to}: ${verificationUrl}`);
    return { messageId: "development-console-delivery" };
  }

  requireMailConfiguration();

  const safeName = escapeHtml(name);
  const safeVerificationUrl = escapeHtml(verificationUrl);

  const result = await getTransporter().sendMail({
    from: env.mailFrom,
    to,
    subject: "Verify your ProbashiCare account",
    text: `Hello ${name}, verify your ProbashiCare account: ${verificationUrl}`,
    html:
      `<p>Hello ${safeName},</p>` +
      "<p>Verify your ProbashiCare account by opening this link:</p>" +
      `<p><a href="${safeVerificationUrl}">Verify email address</a></p>` +
      "<p>This link expires in 24 hours.</p>" +
      "<p>If you did not create this account, you can ignore this email.</p>",
  });

  return {
    messageId: result.messageId,
  };
}

/**
 * Sends a one-time ProbashiCare password-reset link.
 * @param {{to: string, name: string, resetUrl: string}} message - Recipient and one-time reset link.
 * @returns {Promise<{messageId: string}>} Mail provider message identifier.
 * @sideEffects Sends email through SMTP or prints the link in development without SMTP.
 */
export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
}) {
  if (
    env.nodeEnv === "development" &&
    (!env.smtpHost || !env.smtpUser || !env.smtpPass)
  ) {
    console.log(`Development password-reset link for ${to}: ${resetUrl}`);
    return {
      messageId: "development-console-delivery",
    };
  }

  requireMailConfiguration();

  const safeName = escapeHtml(name);
  const safeResetUrl = escapeHtml(resetUrl);
  const result = await getTransporter().sendMail({
    from: env.mailFrom,
    to,
    subject: "Reset your ProbashiCare password",
    text:
      `Hello ${name}, reset your ProbashiCare password: ${resetUrl}. ` +
      "This link expires in one hour.",
    html:
      `<p>Hello ${safeName},</p>` +
      "<p>We received a request to reset your ProbashiCare password.</p>" +
      `<p><a href="${safeResetUrl}">Reset password</a></p>` +
      "<p>This one-time link expires in one hour.</p>" +
      "<p>If you did not request this change, you can safely ignore this email.</p>",
  });

  return {
    messageId: result.messageId,
  };
}
