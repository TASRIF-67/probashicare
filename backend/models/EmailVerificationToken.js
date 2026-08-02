import mongoose from "mongoose";

const emailVerificationTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true },
);

export const EmailVerificationToken = mongoose.model(
  "EmailVerificationToken",
  emailVerificationTokenSchema,
);
