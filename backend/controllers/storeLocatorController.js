import {
  findNearbyStores,
  searchBangladeshAreas,
} from "../services/storeLocatorService.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * GET /api/store-locator/geocode?area=...
 * Resolves a user-entered Bangladesh area without receiving an elderly address.
 * @param {import("express").Request} request - Authenticated area-search request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects May query and cache public OpenStreetMap area data.
 */
export async function geocodeStoreArea(request, response) {
  const results = await searchBangladeshAreas(request.query.area);

  response.json({
    success: true,
    data: {
      results,
    },
  });
}

/**
 * GET /api/store-locator/nearby?latitude=...&longitude=...&radius=...&category=...
 * Returns public mapped stores near a deliberately shared coordinate.
 * @param {import("express").Request} request - Authenticated nearby-search input.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects May query and cache public OpenStreetMap store data.
 */
export async function listNearbyStores(request, response) {
  const latitude = Number(request.query.latitude);
  const longitude = Number(request.query.longitude);
  const radius = request.query.radius === undefined
    ? 1500
    : Number(request.query.radius);
  const category = String(request.query.category || "all");

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new ApiError(422, "Latitude is invalid.");
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new ApiError(422, "Longitude is invalid.");
  }

  if (!Number.isInteger(radius) || radius < 250 || radius > 5000) {
    throw new ApiError(422, "Search radius must be 250 to 5000 metres.");
  }

  if (!["all", "grocery", "pharmacy"].includes(category)) {
    throw new ApiError(422, "Store category must be all, grocery, or pharmacy.");
  }

  const stores = await findNearbyStores({
    latitude,
    longitude,
    radius,
    category,
  });

  response.json({
    success: true,
    data: {
      stores,
      count: stores.length,
      mapNotice:
        "Map results are informational. Confirm opening hours, stock, and delivery directly with the shop.",
    },
  });
}
