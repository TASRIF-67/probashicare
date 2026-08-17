import { useState } from "react";
import { Button } from "../Button.jsx";
import { MapPinIcon, SearchIcon } from "../Icons.jsx";
import { normalizeApiError } from "../../services/api.js";
import { groceryRequestService } from "../../services/groceryRequestService.js";
import { NearbyStoreMap } from "./NearbyStoreMap.jsx";

const DEFAULT_MAP_CENTER = {
  latitude: 23.8103,
  longitude: 90.4125,
};

/**
 * Provides consent-based area or browser-location store discovery.
 * @param {{selectedStore: object|null, onSelect: (store: object) => void}} props - Current store and selection handler.
 * @returns {import("react").ReactElement} Store search, map, and result controls.
 * @sideEffects May request browser location and call protected map endpoints.
 */
export function StoreLocator({ selectedStore, onSelect }) {
  const [area, setArea] = useState("");
  const [areaResults, setAreaResults] = useState([]);
  const [center, setCenter] = useState(DEFAULT_MAP_CENTER);
  const [locationChosen, setLocationChosen] = useState(false);
  const [category, setCategory] = useState("all");
  const [radius, setRadius] = useState(1500);
  const [stores, setStores] = useState([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loadingAction, setLoadingAction] = useState("");

  /**
   * Loads mapped stores around one already approved search centre.
   * @param {{latitude: number, longitude: number}} searchCenter - Area or device coordinates chosen by the user.
   * @returns {Promise<void>}
   * @sideEffects Calls the nearby-store API and updates map results and guidance.
   */
  async function loadStoresAt(searchCenter) {
    // A store chosen for an older area must not be saved after the map moves.
    onSelect(null);
    const data = await groceryRequestService.findNearbyStores({
      ...searchCenter,
      radius: Number(radius),
      category,
    });
    setStores(data.stores);

    if (data.stores.length === 0) {
      setNotice(
        "No mapped shops were found in this distance. Increase the distance or enter a local shop manually.",
      );
    } else {
      setNotice(data.mapNotice);
    }
  }

  /**
   * Resolves the deliberately entered Bangladesh area.
   * @param {void} _unused - This handler accepts no arguments.
   * @returns {Promise<void>}
   * @sideEffects Calls geocoding and updates area choices.
   */
  async function handleAreaSearch() {
    setLoadingAction("area");
    setError("");
    setNotice("");

    try {
      const data = await groceryRequestService.geocodeArea(area);
      setAreaResults(data.results);

      if (data.results.length === 0) {
        setNotice("No mapped area matched. Try a district and nearby landmark.");
        return;
      }

      const bestMatch = data.results[0];
      const nextCenter = {
        latitude: bestMatch.latitude,
        longitude: bestMatch.longitude,
      };
      setCenter(nextCenter);
      setLocationChosen(true);
      await loadStoresAt(nextCenter);
    } catch (requestError) {
      setError(normalizeApiError(requestError).message);
    } finally {
      setLoadingAction("");
    }
  }

  /**
   * Starts area search when Enter is pressed without submitting the purchase form.
   * @param {import("react").KeyboardEvent<HTMLInputElement>} event - Area input keyboard event.
   * @returns {void}
   * @sideEffects Prevents parent-form submission and starts an asynchronous area search.
   */
  function handleAreaKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAreaSearch();
    }
  }

  /**
   * Uses one geocoded area as the store-search centre.
   * @param {object} result - Selected public area result.
   * @returns {Promise<void>}
   * @sideEffects Updates the search centre and loads mapped stores.
   */
  async function chooseArea(result) {
    const nextCenter = {
      latitude: result.latitude,
      longitude: result.longitude,
    };
    setLoadingAction("area");
    setError("");
    setCenter(nextCenter);
    setLocationChosen(true);
    setArea(result.label);
    setAreaResults([]);
    setStores([]);

    try {
      await loadStoresAt(nextCenter);
    } catch (requestError) {
      setError(normalizeApiError(requestError).message);
    } finally {
      setLoadingAction("");
    }
  }

  /**
   * Requests the current device coordinate only after a clear user action.
   * @returns {void}
   * @sideEffects Opens browser geolocation permission and updates the centre.
   */
  function useCurrentLocation() {
    setError("");

    if (!window.isSecureContext) {
      setError(
        "Browser location requires HTTPS or localhost. Search an area instead.",
      );
      return;
    }

    if (!navigator.geolocation) {
      setError("This browser does not support location access.");
      return;
    }

    setLoadingAction("location");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const nextCenter = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setCenter(nextCenter);
        setLocationChosen(true);
        setArea("Current device location");
        setAreaResults([]);
        setStores([]);

        try {
          await loadStoresAt(nextCenter);
        } catch (requestError) {
          setError(normalizeApiError(requestError).message);
        } finally {
          setLoadingAction("");
        }
      },
      (locationError) => {
        if (locationError.code === locationError.PERMISSION_DENIED) {
          setError(
            "Location permission was denied. Search an area instead, or allow location in the browser site settings.",
          );
        } else if (locationError.code === locationError.TIMEOUT) {
          setError("Location lookup timed out. Search an area instead.");
        } else {
          setError("The device location is unavailable. Search an area instead.");
        }

        setLoadingAction("");
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
      },
    );
  }

  /**
   * Loads public mapped stores around the selected centre.
   * @returns {Promise<void>}
   * @sideEffects Calls the nearby-store API and updates the map.
   */
  async function loadNearbyStores() {
    if (!locationChosen) {
      setError("Choose an area or share the device location first.");
      return;
    }

    setLoadingAction("stores");
    setError("");

    try {
      await loadStoresAt(center);
    } catch (requestError) {
      setError(normalizeApiError(requestError).message);
    } finally {
      setLoadingAction("");
    }
  }

  return (
    <section className="store-locator" aria-label="Optional nearby store finder">
      <div className="store-locator__heading">
        <div>
          <span className="eyebrow">Optional map helper</span>
          <h3>Find a nearby shop or pharmacy</h3>
        </div>
        <MapPinIcon size={22} />
      </div>
      <p className="field-hint">
        Search a general area or deliberately share this device location. The
        elderly profile address is never sent automatically.
      </p>
      <div className="store-search-row">
        <label className="field">
          <span>Area, district, or landmark</span>
          <input
            className="input"
            value={area}
            onChange={(event) => setArea(event.target.value)}
            onKeyDown={handleAreaKeyDown}
            placeholder="For example, Dhanmondi 27, Dhaka"
          />
        </label>
        <Button
          type="button"
          variant="secondary"
          isLoading={loadingAction === "area"}
          disabled={Boolean(loadingAction)}
          onClick={handleAreaSearch}
        >
          <SearchIcon size={17} />
          Find area
        </Button>
        <Button
          type="button"
          variant="ghost"
          isLoading={loadingAction === "location"}
          disabled={Boolean(loadingAction)}
          onClick={useCurrentLocation}
        >
          <MapPinIcon size={17} />
          Use my location
        </Button>
      </div>
      {areaResults.length > 0 && (
        <div className="store-area-results">
          {areaResults.map((result) => (
            <button
              type="button"
              key={result.label}
              onClick={() => chooseArea(result)}
            >
              {result.label}
            </button>
          ))}
        </div>
      )}
      {locationChosen && (
        <div className="store-filter-row">
          <label className="field">
            <span>Type</span>
            <select
              className="input"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="all">Shops and pharmacies</option>
              <option value="grocery">Grocery shops</option>
              <option value="pharmacy">Pharmacies</option>
            </select>
          </label>
          <label className="field">
            <span>Distance</span>
            <select
              className="input"
              value={radius}
              onChange={(event) => setRadius(event.target.value)}
            >
              <option value="500">Within 500 m</option>
              <option value="1500">Within 1.5 km</option>
              <option value="3000">Within 3 km</option>
              <option value="5000">Within 5 km</option>
            </select>
          </label>
          <Button
            type="button"
            onClick={loadNearbyStores}
            isLoading={loadingAction === "stores"}
            disabled={Boolean(loadingAction)}
          >
            Search stores
          </Button>
        </div>
      )}
      {error && <div className="alert alert--error">{error}</div>}
      {!locationChosen && (
        <p className="store-map-notice">
          The map starts in central Dhaka. Search an area or use your location
          to load nearby shops.
        </p>
      )}
      {notice && <p className="store-map-notice">{notice}</p>}
      <NearbyStoreMap
        center={center}
        stores={stores}
        selectedStore={selectedStore}
        onSelect={onSelect}
      />
      {stores.length > 0 && (
        <div className="store-result-list">
          {stores.map((store) => {
            const isSelected = selectedStore?.externalId === store.externalId;

            return (
              <button
                type="button"
                className={isSelected ? "store-result store-result--selected" : "store-result"}
                key={store.externalId}
                onClick={() => onSelect(store)}
              >
                <strong>{store.name}</strong>
                <span>{store.category} · {store.distanceKm} km away</span>
                {store.address && <small>{store.address}</small>}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
