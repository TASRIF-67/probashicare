import mongoose from "mongoose";

export const CAREGIVER_APPLICATION_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "suspended",
];
export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const availabilitySchema = new mongoose.Schema(
  {
    day: { type: String, enum: WEEKDAYS, required: true },
    startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  },
  { _id: true },
);

const caregiverProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    phone: { type: String, trim: true, maxlength: 30, default: "" },
    bio: { type: String, trim: true, maxlength: 1000, default: "" },
    skills: { type: [String], default: [] },
    languages: { type: [String], default: [] },
    yearsOfExperience: { type: Number, min: 0, max: 60, default: null },
    hourlyRate: { type: Number, min: 0, default: null },
    monthlyRate: { type: Number, min: 0, default: null },
    serviceArea: { type: String, trim: true, maxlength: 300, default: "" },
    supportedServiceTypes: {
      type: [String],
      default: ["companionship", "personal-care", "medical-support"],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0);
        },
        message: "Supported service types must be a list of non-empty strings.",
      },
    },
    availability: { type: [availabilitySchema], default: [] },
    verificationDocument: {
      publicId: { type: String, default: null },
      resourceType: { type: String, default: null },
      format: { type: String, default: null },
      originalName: { type: String, default: null },
      bytes: { type: Number, default: null },
      uploadedAt: { type: Date, default: null },
    },
    applicationStatus: {
      type: String,
      enum: CAREGIVER_APPLICATION_STATUSES,
      default: "draft",
      index: true,
    },
    rejectionReason: { type: String, trim: true, maxlength: 1000, default: "" },
    submittedAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

/*
 * To add another role-specific profile, create a separate schema linked to User,
 * then add its controllers, guarded routes, frontend service, route gate, and
 * role-specific pages. Keep authentication identity fields in User and domain
 * application data in the role profile.
 */
export const CaregiverProfile = mongoose.model("CaregiverProfile", caregiverProfileSchema);
