import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

const CACHE_DURATION_MS = 15 * 60 * 1000;
const NOMINATIM_DELAY_MS = 1100;
const responseCache = new Map();
let lastNominatimRequestAt = 0;

/**
 * Reads a still-valid value from the small in-memory map cache.
 * @param {string} key - Unique cache key for the external request.
 * @returns {unknown|null} Cached value, or null when missing or expired.
 * @sideEffects Removes an expired cache entry.
 */
function readCache(key) {
  const entry = responseCache.get(key);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return null;
  }

  return entry.value;
}

/**
 * Stores an external response briefly to reduce public API traffic.
 * @param {string} key - Unique cache key.
 * @param {unknown} value - Normalized response value.
 * @returns {void}
 * @sideEffects Adds or replaces one process-memory cache entry.
 */
function writeCache(key, value) {
  responseCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_DURATION_MS,
  });
}

/**
 * Fetches JSON from a public map provider with a timeout and safe identifier.
 * @param {string} url - Fully constructed provider URL.
 * @param {object} [options] - Optional standard fetch settings.
 * @returns {Promise<unknown>} Parsed provider JSON.
 * @sideEffects Performs one outbound HTTP request.
 */
async function fetchProviderJson(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": env.storeLocatorUserAgent,
        Accept: "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new ApiError(
        503,
        "The public store map is temporarily unavailable. Enter the shop manually.",
      );
    }

    return response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      503,
      "The public store map is temporarily unavailable. Enter the shop manually.",
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Waits long enough to respect Nominatim's public request-rate policy.
 * @returns {Promise<void>}
 * @sideEffects Delays an uncached area-search request when needed.
 */
async function respectNominatimRateLimit() {
  const elapsed = Date.now() - lastNominatimRequestAt;
  const remainingDelay = NOMINATIM_DELAY_MS - elapsed;

  if (remainingDelay > 0) {
    await new Promise((resolve) => {
      setTimeout(resolve, remainingDelay);
    });
  }

  lastNominatimRequestAt = Date.now();
}

/**
 * Converts a provider coordinate to a finite number.
 * @param {unknown} value - Provider coordinate value.
 * @returns {number|null} Finite coordinate or null.
 * @sideEffects None.
 */
function readCoordinate(value) {
  const coordinate = Number(value);

  if (!Number.isFinite(coordinate)) {
    return null;
  }

  return coordinate;
}

/**
 * Resolves a deliberately entered Bangladesh area to map coordinates.
 * @param {string} area - User-entered area, district, or landmark.
 * @returns {Promise<Array<{label: string, latitude: number, longitude: number}>>} Up to five area choices.
 * @sideEffects May call OpenStreetMap Nominatim and update the memory cache.
 */
export async function searchBangladeshAreas(area) {
  const query = String(area || "").trim();

  if (query.length < 3 || query.length > 120) {
    throw new ApiError(422, "Enter at least 3 characters for the area search.");
  }

  const cacheKey = "area:" + query.toLowerCase();
  const cached = readCache(cacheKey);

  if (cached) {
    return cached;
  }

  await respectNominatimRateLimit();
  const parameters = new URLSearchParams({
    q: query,
    format: "jsonv2",
    countrycodes: "bd",
    addressdetails: "1",
    limit: "5",
  });
  const providerResults = await fetchProviderJson(
    "https://nominatim.openstreetmap.org/search?" + parameters.toString(),
  );
  const results = [];

  if (Array.isArray(providerResults)) {
    for (const result of providerResults) {
      const latitude = readCoordinate(result.lat);
      const longitude = readCoordinate(result.lon);

      if (latitude === null || longitude === null) {
        continue;
      }

      results.push({
        label: String(result.display_name || query),
        latitude,
        longitude,
      });
    }
  }

  writeCache(cacheKey, results);
  return results;
}

/**
 * Calculates approximate straight-line distance between two coordinates.
 * @param {number} fromLatitude - Starting latitude.
 * @param {number} fromLongitude - Starting longitude.
 * @param {number} toLatitude - Destination latitude.
 * @param {number} toLongitude - Destination longitude.
 * @returns {number} Approximate distance in kilometres.
 * @sideEffects None.
 */
function calculateDistanceKm(
  fromLatitude,
  fromLongitude,
  toLatitude,
  toLongitude,
) {
  const radians = Math.PI / 180;
  const latitudeDifference = (toLatitude - fromLatitude) * radians;
  const longitudeDifference = (toLongitude - fromLongitude) * radians;
  const firstLatitude = fromLatitude * radians;
  const secondLatitude = toLatitude * radians;
  const haversine =
    Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(firstLatitude)
      * Math.cos(secondLatitude)
      * Math.sin(longitudeDifference / 2) ** 2;
  const angularDistance = 2 * Math.atan2(
    Math.sqrt(haversine),
    Math.sqrt(1 - haversine),
  );

  return Math.round(6371 * angularDistance * 100) / 100;
}

/**
 * Builds an Overpass filter for practical Bangladesh store categories.
 * @param {string} category - all, grocery, or pharmacy.
 * @param {number} radius - Search radius in metres.
 * @param {number} latitude - Search-centre latitude.
 * @param {number} longitude - Search-centre longitude.
 * @returns {string} Overpass QL query.
 * @sideEffects None.
 */
function buildOverpassQuery(category, radius, latitude, longitude) {
  const area = "(around:"
    + radius
    + ","
    + latitude
    + ","
    + longitude
    + ")";
  const clauses = [];

  if (category === "all" || category === "grocery") {
    const shopFilter = '["shop"~"supermarket|convenience|general"]';
    clauses.push("node" + area + shopFilter + ";");
    clauses.push("way" + area + shopFilter + ";");
  }

  if (category === "all" || category === "pharmacy") {
    const pharmacyFilter = '["amenity"="pharmacy"]';
    clauses.push("node" + area + pharmacyFilter + ";");
    clauses.push("way" + area + pharmacyFilter + ";");
  }

  return "[out:json][timeout:20];("
    + clauses.join("")
    + ");out center tags;";
}

/**
 * Finds mapped grocery stores or pharmacies near a user-approved coordinate.
 * @param {{latitude: number, longitude: number, radius: number, category: string}} input - Search centre and filters.
 * @returns {Promise<Array<object>>} Distance-sorted public store summaries.
 * @sideEffects May call the public Overpass API and update the memory cache.
 */
export async function findNearbyStores(input) {
  const cacheKey = [
    "nearby",
    input.latitude.toFixed(4),
    input.longitude.toFixed(4),
    input.radius,
    input.category,
  ].join(":");
  const cached = readCache(cacheKey);

  if (cached) {
    return cached;
  }

  const query = buildOverpassQuery(
    input.category,
    input.radius,
    input.latitude,
    input.longitude,
  );
  const parameters = new URLSearchParams({ data: query });
  const providerResponse = await fetchProviderJson(
    "https://overpass-api.de/api/interpreter?" + parameters.toString(),
  );
  const stores = [];

  if (Array.isArray(providerResponse.elements)) {
    for (const element of providerResponse.elements) {
      const latitude = readCoordinate(element.lat ?? element.center?.lat);
      const longitude = readCoordinate(element.lon ?? element.center?.lon);

      if (latitude === null || longitude === null) {
        continue;
      }

      const tags = element.tags || {};
      const addressParts = [];

      if (tags["addr:housenumber"]) {
        addressParts.push(tags["addr:housenumber"]);
      }

      if (tags["addr:street"]) {
        addressParts.push(tags["addr:street"]);
      }

      if (tags["addr:suburb"]) {
        addressParts.push(tags["addr:suburb"]);
      }

      stores.push({
        source: "openstreetmap",
        externalId: String(element.type) + "/" + String(element.id),
        name: String(tags.name || tags.brand || "Mapped local shop"),
        category: String(tags.amenity || tags.shop || "store"),
        address: addressParts.join(", "),
        phone: String(tags.phone || tags["contact:phone"] || ""),
        latitude,
        longitude,
        distanceKm: calculateDistanceKm(
          input.latitude,
          input.longitude,
          latitude,
          longitude,
        ),
      });
    }
  }

  // Sorting makes the map list predictable by showing the closest records first.
  stores.sort((first, second) => first.distanceKm - second.distanceKm);
  const limitedStores = stores.slice(0, 40);
  writeCache(cacheKey, limitedStores);
  return limitedStores;
}
