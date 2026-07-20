import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getTheme, THEME_CHANGE_EVENT, type Theme } from '../lib/theme';

const MAP_TILES: Record<Theme, string> = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
};

const MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

interface Hospital {
  id: string;
  name: string;
  status: 'Green' | 'Yellow' | 'Red';
  latitude: number | null;
  longitude: number | null;
  city: string;
  waitTime: number;
  distance?: number;
  driveMins?: number;
}

interface UserLocation {
  lat: number;
  lng: number;
  city: string;
  isGPS: boolean;
}

interface MapComponentProps {
  hospitals: Hospital[];
  userLocation: UserLocation | null;
  selectedHospital: Hospital | null;
  setSelectedHospital: (hospital: Hospital) => void;
  sortBy?: 'net-wait' | 'proximity' | 'raw-wait';
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Pin palette — aligned with the app's semantic status tokens (hex needed for Leaflet HTML strings). */
const STATUS_PIN_COLORS: Record<Hospital['status'], string> = {
  Green: '#0f7b4d',
  Yellow: '#b45309',
  Red: '#b42318',
};

export function MapComponent({
  hospitals,
  userLocation,
  selectedHospital,
  setSelectedHospital,
  sortBy = 'net-wait',
}: MapComponentProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  /** Last location key we auto-framed the map for — avoid re-flying on hospital poll. */
  const framedLocationKeyRef = useRef<string | null>(null);
  /** Skip auto-pan to selection while framing around the user. */
  const suppressSelectionPanRef = useRef(false);
  /** Last selection frame key (id + peer count) — reframe when peers load. */
  const lastSelectionFrameKeyRef = useRef<string | null>(null);
  const didInitialHospitalFrameRef = useRef(false);

  const hospitalCoords = (list: Hospital[]) =>
    list
      .filter(
        (h): h is Hospital & { latitude: number; longitude: number } =>
          h.latitude != null &&
          h.longitude != null &&
          !Number.isNaN(h.latitude) &&
          !Number.isNaN(h.longitude),
      )
      .map((h) => [h.latitude, h.longitude] as [number, number]);

  /** Pack pins into the viewport — prefer dense city framing over empty provincial canvas. */
  const frameToCoords = (
    map: L.Map,
    coords: [number, number][],
    opts?: { maxZoom?: number; padding?: [number, number]; animate?: boolean },
  ) => {
    if (coords.length === 0) return;
    map.invalidateSize();
    if (coords.length === 1) {
      map.setView(coords[0], opts?.maxZoom ?? 10, {
        animate: opts?.animate ?? true,
        duration: 0.55,
      });
      return;
    }
    const bounds = L.latLngBounds(coords);
    map.fitBounds(bounds, {
      padding: opts?.padding ?? [36, 36],
      maxZoom: opts?.maxZoom ?? 10,
      animate: opts?.animate ?? true,
      duration: 0.55,
    });
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Start denser than provincial overview — hospitals effect will fitBounds to pins.
    const centerLat = userLocation?.lat || 51.05;
    const centerLng = userLocation?.lng || -114.07;
    const initialZoom = userLocation ? 8 : 7;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: true,
    }).setView([centerLat, centerLng], initialZoom);

    // Theme-aware base tiles — dark_all by default, light_all when html.light.
    const initialTheme = getTheme();
    const layer = L.tileLayer(MAP_TILES[initialTheme], {
      attribution: MAP_ATTRIBUTION,
      maxZoom: 20,
    }).addTo(map);
    tileLayerRef.current = layer;

    mapRef.current = map;

    const onThemeChange = () => {
      const next = getTheme();
      if (!mapRef.current) return;
      if (tileLayerRef.current) {
        mapRef.current.removeLayer(tileLayerRef.current);
        tileLayerRef.current = null;
      }
      tileLayerRef.current = L.tileLayer(MAP_TILES[next], {
        attribution: MAP_ATTRIBUTION,
        maxZoom: 20,
      }).addTo(mapRef.current);
    };
    window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);

    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
      tileLayerRef.current = null;
      // Drop marker refs so a remount does not "update" markers bound to the destroyed map
      // (labs often mount with a full pin list already loaded — ER usually starts empty).
      for (const id of Object.keys(markersRef.current)) {
        try { markersRef.current[id].remove(); } catch { /* map already gone */ }
      }
      markersRef.current = {};
      if (userMarkerRef.current) {
        try { userMarkerRef.current.remove(); } catch { /* map already gone */ }
        userMarkerRef.current = null;
      }
      framedLocationKeyRef.current = null;
      lastSelectionFrameKeyRef.current = null;
      didInitialHospitalFrameRef.current = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);



  // Sync Markers & Hospital list
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers that might not be in the current hospitals list
    Object.keys(markersRef.current).forEach(id => {
      if (!hospitals.find(h => h.id === id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Create custom CSS/HTML DivIcon for hospitals
    const createHospitalIcon = (status: Hospital['status'], isSelected: boolean) => {
      const color = STATUS_PIN_COLORS[status] ?? STATUS_PIN_COLORS.Green;

      return L.divIcon({
        html: `
          <div class="relative flex items-center justify-center cursor-pointer" style="width: 24px; height: 24px;">
            ${isSelected ? `<span class="absolute inline-flex h-6 w-6 animate-ping rounded-full opacity-60" style="background-color: ${color}"></span>` : ''}
            <span class="relative inline-flex rounded-full h-3.5 w-3.5 border-2 border-white shadow-md transition-all duration-300" style="background-color: ${color}; transform: ${isSelected ? 'scale(1.25)' : 'scale(1)'}"></span>
          </div>
        `,
        className: 'custom-leaflet-icon',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
    };

    // Add or update markers
    hospitals.forEach(h => {
      if (h.latitude == null || h.longitude == null || Number.isNaN(h.latitude) || Number.isNaN(h.longitude)) return;
      const isSelected = selectedHospital?.id === h.id;
      const icon = createHospitalIcon(h.status, isSelected);

      const formatMinutesToHm = (mins: number) => {
        if (mins <= 0) return '0m';
        const hrs = Math.floor(mins / 60);
        const remainingMins = mins % 60;
        if (hrs > 0) {
          return `${hrs}:${remainingMins.toString().padStart(2, '0')}`;
        }
        return `${remainingMins}m`;
      };

      const statusColors: Record<Hospital['status'], string> = {
        Green: 'text-ok',
        Yellow: 'text-warn',
        Red: 'text-crit'
      };
      
      const statusLabels = {
        Green: 'Low Queue',
        Yellow: 'Medium Queue',
        Red: 'High Queue'
      };

      const hasDrive = h.driveMins !== undefined && h.driveMins !== null;
      let bottomRow = '';
      if (sortBy === 'raw-wait') {
        if (hasDrive) {
          bottomRow = `
            <div class="flex items-center gap-1.5 mt-1.5 pt-1 border-t border-line text-[10px] text-ink-3">
              <span class="font-bold ${statusColors[h.status]}">Wait: ${formatMinutesToHm(h.waitTime)}</span>
              <span class="text-line-2">•</span>
              <span>Drive: ~${formatMinutesToHm(h.driveMins || 0)}</span>
              <span class="text-line-2">•</span>
              <span class="font-medium text-accent">Net: ${formatMinutesToHm((h.driveMins || 0) + h.waitTime)}</span>
            </div>
          `;
        } else {
          bottomRow = `
            <div class="flex items-center gap-1.5 mt-1.5 pt-1 border-t border-line">
              <span class="font-bold ${statusColors[h.status]}">Wait: ${formatMinutesToHm(h.waitTime)}</span>
              <span class="text-line-2">•</span>
              <span class="font-medium text-ink-3">${statusLabels[h.status]}</span>
            </div>
          `;
        }
      } else {
        if (hasDrive) {
          bottomRow = `
            <div class="flex items-center gap-1.5 mt-1.5 pt-1 border-t border-line text-[10px] text-ink-3">
              <span class="font-bold text-accent">Net: ${formatMinutesToHm((h.driveMins || 0) + h.waitTime)}</span>
              <span class="text-line-2">•</span>
              <span>Wait: ${formatMinutesToHm(h.waitTime)}</span>
              <span class="text-line-2">•</span>
              <span>Drive: ~${formatMinutesToHm(h.driveMins || 0)}</span>
            </div>
          `;
        } else {
          bottomRow = `
            <div class="flex items-center gap-1.5 mt-1.5 pt-1 border-t border-line">
              <span class="font-bold text-accent">Wait: ${formatMinutesToHm(h.waitTime)}</span>
              <span class="text-line-2">•</span>
              <span class="font-medium ${statusColors[h.status]}">${statusLabels[h.status]}</span>
            </div>
          `;
        }
      }

      const tooltipContent = `
        <div class="text-[11px] font-sans leading-relaxed select-none">
          <p class="font-bold text-ink text-[12px] leading-tight mb-0.5">${h.name}</p>
          <p class="text-ink-3 font-medium">${h.city}</p>
          ${bottomRow}
        </div>
      `;

      if (markersRef.current[h.id]) {
        // Update position & icon & tooltip
        markersRef.current[h.id].setLatLng([h.latitude, h.longitude]);
        markersRef.current[h.id].setIcon(icon);
        markersRef.current[h.id].unbindTooltip().bindTooltip(tooltipContent, {
          direction: 'auto',
          className: 'custom-leaflet-tooltip',
          opacity: 0.95,
          offset: [0, 0]
        });
        if (isSelected) {
          markersRef.current[h.id].setZIndexOffset(1000);
        } else {
          markersRef.current[h.id].setZIndexOffset(0);
        }
      } else {
        // Create new marker with tooltip
        const marker = L.marker([h.latitude, h.longitude], { icon })
          .addTo(map)
          .bindTooltip(tooltipContent, {
            direction: 'auto',
            className: 'custom-leaflet-tooltip',
            opacity: 0.95,
            offset: [0, 0]
          })
          .on('click', () => {
            setSelectedHospital(h);
          });
        markersRef.current[h.id] = marker;
      }
    });
  }, [hospitals, selectedHospital, setSelectedHospital, sortBy]);

  // Sync user marker; frame map only when the user location actually changes.
  // When hospitals first arrive (no user location), frame the pin set instead of empty province.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || userLocation || didInitialHospitalFrameRef.current) return;
    const coords = hospitalCoords(hospitals);
    if (coords.length === 0) return;
    // Don't fight selection framing — selection effect will pack to city cluster.
    if (selectedHospital?.latitude != null) return;
    didInitialHospitalFrameRef.current = true;
    frameToCoords(map, coords, { maxZoom: 4.5, padding: [24, 24], animate: false });
  }, [hospitals, userLocation, selectedHospital]);

  // Sync user marker; frame map only when the user location actually changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userLocation && userLocation.lat && userLocation.lng) {
      const userIcon = L.divIcon({
        html: `
          <div class="relative flex items-center justify-center" style="width: 32px; height: 32px;">
            <span class="relative inline-flex rounded-full h-4.5 w-4.5 bg-accent border-2 border-white shadow-lg flex items-center justify-center">
              <svg class="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(45deg);">
                <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
              </svg>
            </span>
          </div>
        `,
        className: 'custom-leaflet-user-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
        userMarkerRef.current.setIcon(userIcon);
      } else {
        userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
          icon: userIcon,
          zIndexOffset: 2000,
        }).addTo(map);
      }

      const locationKey = `${userLocation.lat.toFixed(3)},${userLocation.lng.toFixed(3)}`;

      const nearbyCoords = hospitals
        .filter((h) => {
          if (h.latitude == null || h.longitude == null) return false;
          if (Number.isNaN(h.latitude) || Number.isNaN(h.longitude)) return false;
          return haversineKm(userLocation.lat, userLocation.lng, h.latitude, h.longitude) <= 55;
        })
        .map((h) => [h.latitude as number, h.longitude as number] as [number, number]);

      // Frame once per location; allow a second frame when nearby hospitals first load.
      const frameKey = `${locationKey}|${nearbyCoords.length > 0 ? 'near' : 'solo'}`;
      if (framedLocationKeyRef.current === frameKey) return;
      if (
        framedLocationKeyRef.current?.startsWith(`${locationKey}|`) &&
        nearbyCoords.length === 0
      ) {
        return;
      }
      framedLocationKeyRef.current = frameKey;
      suppressSelectionPanRef.current = true;

      if (nearbyCoords.length > 0) {
        frameToCoords(map, [...nearbyCoords, [userLocation.lat, userLocation.lng]], {
          maxZoom: 10,
          padding: [40, 40],
        });
      } else {
        frameToCoords(map, [[userLocation.lat, userLocation.lng]], { maxZoom: 10 });
      }

      window.setTimeout(() => {
        suppressSelectionPanRef.current = false;
      }, 900);
    } else {
      framedLocationKeyRef.current = null;
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
    }
  }, [userLocation, hospitals]);

  // Handle container resizing to make sure map fills container perfectly
  useEffect(() => {
    const map = mapRef.current;
    const container = mapContainerRef.current;
    if (!map || !container) return;

    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    });

    resizeObserver.observe(container);
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 150);
    const timer2 = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 600);

    return () => {
      resizeObserver.disconnect();
      clearTimeout(timer);
      clearTimeout(timer2);
    };
  }, []);

  // Selection framing: always pack the selected site's metro — never widen to user GPS.
  // Selection framing: pack selected site metro; reframe when peer pins arrive.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedHospital || selectedHospital.latitude == null || selectedHospital.longitude == null) {
      return;
    }
    if (suppressSelectionPanRef.current) return;

    const selectedCoord: [number, number] = [
      selectedHospital.latitude,
      selectedHospital.longitude,
    ];

    const sameCity = hospitals
      .filter((h) => {
        if (h.latitude == null || h.longitude == null) return false;
        return h.city.toLowerCase() === selectedHospital.city.toLowerCase();
      })
      .map((h) => [h.latitude as number, h.longitude as number] as [number, number]);

    const nearCoords =
      sameCity.length > 1
        ? sameCity
        : hospitals
            .filter((h) => {
              if (h.latitude == null || h.longitude == null) return false;
              return (
                haversineKm(
                  selectedHospital.latitude!,
                  selectedHospital.longitude!,
                  h.latitude,
                  h.longitude,
                ) <= 18
              );
            })
            .map((h) => [h.latitude as number, h.longitude as number] as [number, number]);

    const coords = nearCoords.length > 0 ? nearCoords : [selectedCoord];
    const frameKey = `${selectedHospital.id}|${coords.length}`;
    if (lastSelectionFrameKeyRef.current === frameKey) return;
    lastSelectionFrameKeyRef.current = frameKey;

    requestAnimationFrame(() => {
      if (!mapRef.current) return;
      if (coords.length >= 2) {
        const bounds = L.latLngBounds(coords);
        mapRef.current.invalidateSize();
        mapRef.current.fitBounds(bounds, {
          padding: [28, 28],
          maxZoom: 10,
          animate: true,
          duration: 0.5,
        });
      } else {
        frameToCoords(mapRef.current, coords, { maxZoom: 11, padding: [24, 24] });
      }
      window.setTimeout(() => mapRef.current?.invalidateSize(), 250);
    });
  }, [selectedHospital, hospitals]);
  return (
    <div className="absolute inset-0">
      <div ref={mapContainerRef} className="h-full w-full z-0" />
    </div>
  );
}
