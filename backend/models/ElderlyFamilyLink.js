import mongoose from "mongoose";

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
    relationship: { type: String, required: true, trim: true, maxlength: 80 },
    permission: { type: String, enum: ["owner", "editor", "viewer"], default: "owner" },
    linkedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["active", "revoked"], default: "active", index: true },
  },
  { timestamps: true },
);

elderlyFamilyLinkSchema.index({ elderlyProfileId: 1, familyUserId: 1 }, { unique: true });

export const ElderlyFamilyLink = mongoose.model("ElderlyFamilyLink", elderlyFamilyLinkSchema);
