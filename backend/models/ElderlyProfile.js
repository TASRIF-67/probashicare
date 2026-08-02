import mongoose from "mongoose";

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"];
export const GENDERS = ["female", "male", "non-binary", "prefer-not-to-say"];
export const MEDICAL_STATUSES = ["active", "recovered", "managed", "unknown"];
export const ALLERGY_TYPES = ["medicine", "food", "environmental", "other"];
export const SEVERITIES = ["mild", "moderate", "severe", "unknown"];

const medicalHistorySchema = new mongoose.Schema(
  {
    condition: { type: String, required: true, trim: true, maxlength: 150 },
    diagnosisDate: { type: Date, default: null },
    treatmentSummary: { type: String, trim: true, maxlength: 1000, default: "" },
    hospitalOrDoctor: { type: String, trim: true, maxlength: 200, default: "" },
    status: { type: String, enum: MEDICAL_STATUSES, default: "unknown" },
    notes: { type: String, trim: true, maxlength: 1000, default: "" },
  },
  { _id: true },
);

const allergySchema = new mongoose.Schema(
  {
    allergen: { type: String, required: true, trim: true, maxlength: 150 },
    type: { type: String, enum: ALLERGY_TYPES, default: "other" },
    reaction: { type: String, trim: true, maxlength: 300, default: "" },
    severity: { type: String, enum: SEVERITIES, default: "unknown" },
    notes: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { _id: true },
);

const medicationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    strength: { type: String, trim: true, maxlength: 80, default: "" },
    dosage: { type: String, trim: true, maxlength: 150, default: "" },
    form: { type: String, trim: true, maxlength: 80, default: "" },
    reason: { type: String, trim: true, maxlength: 300, default: "" },
    prescribingDoctor: { type: String, trim: true, maxlength: 200, default: "" },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    notes: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { _id: true },
);

const chronicDiseaseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    diagnosisDate: { type: Date, default: null },
    managingDoctor: { type: String, trim: true, maxlength: 200, default: "" },
    status: { type: String, enum: MEDICAL_STATUSES, default: "active" },
    notes: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { _id: true },
);

const emergencyContactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    relationship: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    alternativePhone: { type: String, trim: true, maxlength: 30, default: "" },
    address: { type: String, trim: true, maxlength: 300, default: "" },
    priority: { type: Number, min: 1, max: 20, default: 1 },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: true },
);

const elderlyProfileSchema = new mongoose.Schema(
  {
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    personalInformation: {
      fullName: { type: String, required: true, trim: true, maxlength: 100 },
      preferredName: { type: String, trim: true, maxlength: 100, default: "" },
      dateOfBirth: { type: Date, required: true },
      gender: { type: String, enum: GENDERS, required: true },
      bloodGroup: { type: String, enum: BLOOD_GROUPS, default: "unknown" },
      phone: { type: String, trim: true, maxlength: 30, default: "" },
      address: { type: String, required: true, trim: true, maxlength: 300 },
      district: { type: String, required: true, trim: true, maxlength: 100 },
      division: { type: String, required: true, trim: true, maxlength: 100 },
      preferredLanguage: { type: String, trim: true, maxlength: 80, default: "Bangla" },
      familyRelationship: { type: String, required: true, trim: true, maxlength: 80 },
      careNotes: { type: String, trim: true, maxlength: 1500, default: "" },
    },
    profilePhotoUrl: { type: String, default: null },
    medicalHistory: { type: [medicalHistorySchema], default: [] },
    allergies: { type: [allergySchema], default: [] },
    medications: { type: [medicationSchema], default: [] },
    chronicDiseases: { type: [chronicDiseaseSchema], default: [] },
    emergencyContacts: { type: [emergencyContactSchema], default: [] },
    status: { type: String, enum: ["active", "archived"], default: "active", index: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

/*
 * To add another health model, create its schema in backend/models and reference
 * ElderlyProfile by ID. Add its controller and routes, register them in app.js,
 * then add a frontend service and consume it through a focused hook or page.
 * Avoid expanding this profile document with time-series or transactional data.
 */
export const ElderlyProfile = mongoose.model("ElderlyProfile", elderlyProfileSchema);
