import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDatabase } from "../config/database.js";
import { validateEnvironment } from "../config/env.js";
import { User } from "../models/User.js";

/**
 * Creates or updates the single configured seeded admin account.
 * @param {void} _unused - Reads `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` from environment.
 * @returns {Promise<void>}
 * @sideEffects Connects to MongoDB and writes an admin User; never exposes public admin signup.
 */
async function seedAdmin() {
  validateEnvironment(["MONGODB_URI"]);
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const minimumPasswordLength = process.env.NODE_ENV === "development" ? 5 : 12;
  if (!name || !email || !password || password.length < minimumPasswordLength) {
    throw new Error(
      `ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD (${minimumPasswordLength}+ characters) are required.`,
    );
  }

  await connectDatabase();
  await User.findOneAndUpdate(
    { email },
    {
      name,
      email,
      password: await bcrypt.hash(password, 12),
      role: "admin",
      isVerified: true,
      googleId: null,
    },
    { upsert: true, new: true, runValidators: true },
  );
  console.log(`Admin account ready: ${email}`);
}

seedAdmin()
  .catch((error) => {
    console.error("Admin seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
