import mongoose from "mongoose";

export const USER_ROLES = [
  "family",
  "admin",
  "caregiver",
  "elderly",
];

// User stores authentication identity only. Feature-specific information stays
// in separate profile/subscription models instead of growing this document.
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Password hashes and Google IDs are server-only authentication fields.
    password: {
      type: String,
      default: null,
      select: false,
    },
    googleId: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: "family",
      index: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Only Google-linked users have a string googleId. The partial unique index
// ignores null values but prevents two users sharing one Google identity.
userSchema.index(
  {
    googleId: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      googleId: {
        $type: "string",
      },
    },
  },
);

export const User = mongoose.model(
  "User",
  userSchema,
);
