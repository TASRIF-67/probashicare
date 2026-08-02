import { getCloudinaryClient, isCloudinaryConfigured } from "../config/cloudinary.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Uploads a caregiver verification document as an authenticated Cloudinary asset.
 * @param {{buffer: Buffer, mimetype: string, originalname: string, caregiverUserId: string}} input - In-memory file and owner identity.
 * @returns {Promise<{publicId: string, resourceType: string, format: string, originalName: string, bytes: number, uploadedAt: Date}>} Stored document metadata.
 * @sideEffects Uploads a private asset to Cloudinary.
 */
export async function uploadCaregiverDocument({
  buffer,
  mimetype,
  originalname,
  caregiverUserId,
}) {
  if (!isCloudinaryConfigured()) {
    throw new ApiError(
      503,
      "Document upload is not configured yet. Add Cloudinary credentials to backend/.env.",
    );
  }

  const client = getCloudinaryClient();
  const dataUri = `data:${mimetype};base64,${buffer.toString("base64")}`;
  const result = await client.uploader.upload(dataUri, {
    folder: `probashicare/caregiver-verification/${caregiverUserId}`,
    type: "authenticated",
    resource_type: "auto",
    use_filename: false,
    unique_filename: true,
  });

  return {
    publicId: result.public_id,
    resourceType: result.resource_type,
    format: result.format || "",
    originalName: originalname,
    bytes: result.bytes,
    uploadedAt: new Date(),
  };
}

/**
 * Generates a short-lived signed URL for an authenticated verification document.
 * @param {{publicId: string, resourceType: string, format?: string}} document - Stored Cloudinary metadata.
 * @returns {string|null} Signed delivery URL or `null` when Cloudinary is not configured.
 * @sideEffects Reads Cloudinary configuration and signs a delivery URL locally.
 */
export function createCaregiverDocumentUrl(document) {
  if (!document?.publicId || !isCloudinaryConfigured()) return null;
  const client = getCloudinaryClient();
  return client.url(document.publicId, {
    type: "authenticated",
    resource_type: document.resourceType || "image",
    format: document.format || undefined,
    sign_url: true,
    secure: true,
    expires_at: Math.floor(Date.now() / 1000) + 10 * 60,
  });
}

/**
 * Removes a superseded caregiver verification document.
 * @param {{publicId: string, resourceType?: string}|null} document - Previous Cloudinary metadata.
 * @returns {Promise<void>}
 * @sideEffects Deletes the prior authenticated asset from Cloudinary when configured.
 */
export async function deleteCaregiverDocument(document) {
  if (!document?.publicId || !isCloudinaryConfigured()) return;
  const client = getCloudinaryClient();
  await client.uploader.destroy(document.publicId, {
    type: "authenticated",
    resource_type: document.resourceType || "image",
    invalidate: true,
  });
}
