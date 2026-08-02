import nodemailer from "nodemailer";
import { env } from "../config/env.js";

let transporter;

/**
 * Lazily creates the SMTP transport so startup does not open unnecessary connections.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {import("nodemailer").Transporter} Configured reusable mail transporter.
 * @sideEffects Creates an SMTP transport object on first use.
 */
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth: { user: env.smtpUser, pass: env.smtpPass },
    });
  }
  return transporter;
}

/**
 * Sends a family account verification link.
 * @param {{to: string, name: string, verificationUrl: string}} message - Recipient details and one-time link.
 * @returns {Promise<{messageId: string}>} Mail provider message identifier.
 * @sideEffects Sends an email through the configured SMTP provider.
 */
export async function sendVerificationEmail({ to, name, verificationUrl }) {
  if (env.nodeEnv === "development" && (!env.smtpHost || !env.smtpUser || !env.smtpPass)) {
    console.log(`Development verification link for ${to}: ${verificationUrl}`);
    return { messageId: "development-console-delivery" };
  }

  if (!env.smtpHost || !env.smtpUser || !env.smtpPass) {
    throw new Error("SMTP configuration is required to send verification emails.");
  }

  const result = await getTransporter().sendMail({
    from: env.mailFrom,
    to,
    subject: "Verify your ProbashiCare account",
    text: `Hello ${name}, verify your ProbashiCare account: ${verificationUrl}`,
    html: `<p>Hello ${name},</p><p>Verify your ProbashiCare account by opening this link:</p><p><a href="${verificationUrl}">Verify email address</a></p><p>This link expires in 24 hours.</p>`,
  });

  return { messageId: result.messageId };
}
