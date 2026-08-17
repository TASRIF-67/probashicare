import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Renders an interactive OpenStreetMap with selectable store markers.
 * @param {{center: {latitude: number, longitude: number}, stores: object[], selectedStore: object|null, onSelect: (store: object) => void}} props - Map centre, results, selection, and callback.
 * @returns {import("react").ReactElement} Leaflet map container.
 * @sideEffects Creates and removes a Leaflet map and public tile layer.
 */
export function NearbyStoreMap({
  center,
  stores,
  selectedStore,
  onSelect,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerLayerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return undefined;
    }

    const map = L.map(containerRef.current, {
      zoomControl: true,
    }).setView([center.latitude, center.longitude], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const resizeFrameId = window.requestAnimationFrame(() => {
      map.invalidateSize();
    });

    return () => {
      window.cancelAnimationFrame(resizeFrameId);
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerLayerRef.current) {
      return;
    }

    mapRef.current.invalidateSize();
    markerLayerRef.current.clearLayers();
    const visibleCoordinates = [
      [center.latitude, center.longitude],
    ];

    L.circleMarker([center.latitude, center.longitude], {
      radius: 7,
      color: "#ffffff",
      weight: 3,
      fillColor: "#146b57",
      fillOpacity: 1,
    })
      .bindTooltip("Search centre")
      .addTo(markerLayerRef.current);

    for (const store of stores) {
      const isSelected = selectedStore?.externalId === store.externalId;
      const marker = L.circleMarker([store.latitude, store.longitude], {
        radius: isSelected ? 9 : 7,
        color: isSelected ? "#7a4a08" : "#ffffff",
        weight: 3,
        fillColor: isSelected ? "#e6a23c" : "#247b68",
        fillOpacity: 1,
      });
      marker.bindTooltip(store.name);
      marker.on("click", () => {
        onSelect(store);
      });
      marker.addTo(markerLayerRef.current);
      visibleCoordinates.push([store.latitude, store.longitude]);
    }

    if (stores.length > 0) {
      mapRef.current.fitBounds(visibleCoordinates, {
        padding: [28, 28],
        maxZoom: 16,
      });
    } else {
      mapRef.current.setView([center.latitude, center.longitude], 14);
    }
  }, [center, onSelect, selectedStore, stores]);

  return (
    <div
      ref={containerRef}
      className="grocery-store-map"
      role="application"
      aria-label="Nearby grocery store and pharmacy map"
    />
  );
}
