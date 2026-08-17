import multer from "multer";
import { ApiError } from "../utils/ApiError.js";

const ALLOWED_DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png"];

/**
 * Accepts only PDF, JPEG, and PNG caregiver verification documents.
 * @param {import("express").Request} _request - Express request, unused.
 * @param {Express.Multer.File} file - Incoming multipart file metadata.
 * @param {(error: Error|null, accept?: boolean) => void} callback - Multer decision callback.
 * @returns {void}
 * @sideEffects Accepts the upload or forwards a 422 ApiError.
 */
function verificationDocumentFilter(_request, file, callback) {
  if (!ALLOWED_DOCUMENT_TYPES.includes(file.mimetype)) {
    callback(new ApiError(422, "Verification document must be a PDF, JPG, or PNG file."));
    return;
  }
  callback(null, true);
}

export const uploadVerificationDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: verificationDocumentFilter,
}).single("document");

/**
 * Accepts an optional grocery receipt as PDF, JPEG, or PNG.
 * @param {import("express").Request} _request - Express request, unused.
 * @param {Express.Multer.File} file - Incoming receipt metadata.
 * @param {(error: Error|null, accept?: boolean) => void} callback - Multer decision callback.
 * @returns {void}
 * @sideEffects Accepts the upload or forwards a 422 validation error.
 */
function groceryReceiptFilter(_request, file, callback) {
  if (!ALLOWED_DOCUMENT_TYPES.includes(file.mimetype)) {
    callback(
      new ApiError(
        422,
        "Purchase receipt must be a PDF, JPG, or PNG file.",
      ),
    );
    return;
  }

  callback(null, true);
}

export const uploadGroceryReceiptFile = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: groceryReceiptFilter,
}).single("receipt");
