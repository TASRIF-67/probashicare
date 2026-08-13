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

  const trialDays = Number(process.env.FAMILY_TRIAL_DAYS || 7);

  if (!Number.isInteger(trialDays) || trialDays < 1 || trialDays > 365) {
    throw new Error(
      "FAMILY_TRIAL_DAYS must be a whole number between 1 and 365.",
    );
  }

  const currency = process.env.SUBSCRIPTION_CURRENCY || "BDT";

  if (currency !== "BDT") {
    throw new Error("SUBSCRIPTION_CURRENCY must be BDT for prototype plans.");
  }

  const prototypeSetting = process.env.PROTOTYPE_PAYMENTS_ENABLED;

  if (
    prototypeSetting &&
    prototypeSetting !== "true" &&
    prototypeSetting !== "false"
  ) {
    throw new Error(
      "PROTOTYPE_PAYMENTS_ENABLED must be true or false.",
    );
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
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
  requireCaregiverDocument: process.env.REQUIRE_CAREGIVER_DOCUMENT === "true",
  familyTrialDays: Number(process.env.FAMILY_TRIAL_DAYS) || 7,
  subscriptionCurrency: process.env.SUBSCRIPTION_CURRENCY || "BDT",
  prototypePaymentsEnabled:
    process.env.PROTOTYPE_PAYMENTS_ENABLED === "true",
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || "gemini-flash-lite-latest",
};
