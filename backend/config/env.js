import dotenv from "dotenv";

dotenv.config();

const requiredVariables = ["MONGODB_URI", "JWT_SECRET", "CLIENT_URL"];

/**
 * Validates required environment variables at startup.
 * @param {string[]} names - Variable names that must contain non-empty values.
 * @returns {void}
 * @sideEffects Throws an Error and prevents server startup when configuration is incomplete.
 */
export function validateEnvironment(names = requiredVariables) {
  const missing = names.filter((name) => !process.env[name]?.trim());

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  clientUrl: process.env.CLIENT_URL,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT) || 587,
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  mailFrom: process.env.MAIL_FROM || "ProbashiCare <no-reply@probashicare.local>",
};
