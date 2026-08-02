import mongoose from "mongoose";
import { env } from "./env.js";

/**
 * Opens the shared MongoDB connection used by all Mongoose models.
 * @param {string} [uri=env.mongoUri] - MongoDB connection string.
 * @returns {Promise<typeof mongoose>} The connected Mongoose instance.
 * @sideEffects Opens a database connection and emits connection events.
 */
export async function connectDatabase(uri = env.mongoUri) {
  mongoose.connection.on("error", (error) => {
    console.error("MongoDB connection error:", error.message);
  });

  return mongoose.connect(uri);
}
