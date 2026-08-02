import mongoose from "mongoose";

export const USER_ROLES = ["family", "admin", "caregiver", "elderly"];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, default: null, select: false },
    googleId: { type: String, default: null },
    role: { type: String, enum: USER_ROLES, default: "family", index: true },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

userSchema.index(
  { googleId: 1 },
  {
    unique: true,
    partialFilterExpression: { googleId: { $type: "string" } },
  },
);

/*
 * To add a new model, create its schema in backend/models, export the model, then add
 * a controller and route file. Register the route in app.js, expose matching methods
 * in a frontend service, and consume those methods through a focused hook or page.
 * Keep references between models explicit rather than gradually expanding User.
 */
export const User = mongoose.model("User", userSchema);
