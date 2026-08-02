import { v2 as cloudinary } from "cloudinary";
import { env } from "./env.js";

/**
 * Configures and returns the shared Cloudinary SDK instance.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {import("cloudinary").v2} Configured Cloudinary client.
 * @sideEffects Updates process-wide Cloudinary SDK configuration.
 */
export function getCloudinaryClient() {
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: true,
  });
  return cloudinary;
}

/**
 * Reports whether all required Cloudinary credentials are available.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {boolean} `true` when cloud name, key, and secret are configured.
 * @sideEffects None.
 */
export function isCloudinaryConfigured() {
  return Boolean(
    env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret,
  );
}
