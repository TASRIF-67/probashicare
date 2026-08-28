import mongoose from "mongoose";

// One user can have only one active password-reset record. Requesting another
// link deletes/replaces the older record.
const passwordResetTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      // MongoDB removes expired records asynchronously. The controller also
      // requires expiresAt > now so an expired token cannot be used meanwhile.
      expires: 0,
    },
  },
  {
    timestamps: true,
  },
);

export const PasswordResetToken = mongoose.model(
  "PasswordResetToken",
  passwordResetTokenSchema,
);
