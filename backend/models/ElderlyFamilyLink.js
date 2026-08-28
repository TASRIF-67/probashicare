import mongoose from "mongoose";

/*
 * This model uses a separate collection because access is a relationship between
 * a family user and an elderly profile. Keeping it separate supports multiple
 * family members without copying private health data.
 */

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

// 'index()' creates a compound MongoDB index from the two fields. 'unique: true'
// prevents duplicate links for the same family user and elderly profile pair.
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
// 'mongoose.model()' creates the class used to query and save link documents.
export const ElderlyFamilyLink = mongoose.model(
  "ElderlyFamilyLink",
  elderlyFamilyLinkSchema,
);
