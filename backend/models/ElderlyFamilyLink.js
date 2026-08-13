import mongoose from "mongoose";

// This link collection allows one elderly profile to be shared with multiple family users.
const elderlyFamilyLinkSchema = new mongoose.Schema(
  {
    elderlyProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ElderlyProfile",
      required: true,
      index: true,
    },
    familyUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Relationship is descriptive, while permission controls allowed operations.
    relationship: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    permission: {
      type: String,
      enum: ["owner", "editor", "viewer"],
      default: "owner",
    },

    // `linkedBy` provides an audit reference for who granted the family access.
    linkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Revocation preserves the historical relationship instead of deleting it silently.
    status: {
      type: String,
      enum: ["active", "revoked"],
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// A family user can have only one link record for a particular elderly profile.
elderlyFamilyLinkSchema.index(
  {
    elderlyProfileId: 1,
    familyUserId: 1,
  },
  {
    unique: true,
  },
);

/*
 * To add another profile-sharing relationship, create a dedicated link model
 * containing both entity references, explicit permissions, audit ownership, and
 * a revocable status. Add access-service queries before exposing controller or
 * frontend operations; do not infer authorization from who created a profile.
 */
export const ElderlyFamilyLink = mongoose.model(
  "ElderlyFamilyLink",
  elderlyFamilyLinkSchema,
);
