import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

export function MapComponent({
  hospitals,
  userLocation,
  selectedHospital,
  setSelectedHospital,
  sortBy = 'net-wait'
}: MapComponentProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const userMarkerRef = useRef<L.Marker | null>(null);
  /** Last location key we auto-framed the map for — avoid re-flying on hospital poll. */
  const framedLocationKeyRef = useRef<string | null>(null);
  /** Skip auto-pan to selection while framing around the user. */
  const suppressSelectionPanRef = useRef(false);
  const lastSelectionPanIdRef = useRef<string | null>(null);
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
      map.setView(coords[0], opts?.maxZoom ?? 12, {
        animate: opts?.animate ?? true,
        duration: 0.55,
      });
      return;
    }
    const bounds = L.latLngBounds(coords);
    map.fitBounds(bounds, {
      padding: opts?.padding ?? [36, 36],
      maxZoom: opts?.maxZoom ?? 12,
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
    const initialZoom = userLocation ? 10 : 9;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: true,
    }).setView([centerLat, centerLng], initialZoom);

    // Add clean, dark OpenStreetMap style layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20,
    }).addTo(map);

    mapRef.current = map;

    return () => {
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
    const createHospitalIcon = (status: string, isSelected: boolean) => {
      let color = '#10b981'; // Green
      if (status === 'Red') color = '#ef4444';
      else if (status === 'Yellow') color = '#f59e0b';

      return L.divIcon({
        html: `
          <div class="relative flex items-center justify-center cursor-pointer" style="width: 24px; height: 24px;">
            ${isSelected ? `<span class="absolute inline-flex h-6 w-6 animate-ping rounded-full opacity-60" style="background-color: ${color}"></span>` : ''}
            <span class="relative inline-flex rounded-full h-3.5 w-3.5 border-2 border-[#090d16] shadow-md transition-all duration-300" style="background-color: ${color}; transform: ${isSelected ? 'scale(1.25)' : 'scale(1)'}"></span>
          </div>
        `,
        className: 'custom-leaflet-icon',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
    };

    // Add or update markers
    hospitals.forEach(h => {
      if (h.latitude === null || h.longitude === null) return;

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

      const statusColors = {
        Green: 'text-emerald-400',
        Yellow: 'text-amber-400',
        Red: 'text-red-400'
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
            <div class="flex items-center gap-1.5 mt-1.5 pt-1 border-t border-slate-800/60 text-[10px] text-slate-400">
              <span class="font-black ${statusColors[h.status]}">Wait: ${formatMinutesToHm(h.waitTime)}</span>
              <span class="text-slate-600">•</span>
              <span>Drive: ~${formatMinutesToHm(h.driveMins || 0)}</span>
              <span class="text-slate-600">•</span>
              <span class="font-medium text-cyan-500">Net: ${formatMinutesToHm((h.driveMins || 0) + h.waitTime)}</span>
            </div>
          `;
        } else {
          bottomRow = `
            <div class="flex items-center gap-1.5 mt-1.5 pt-1 border-t border-slate-800/60">
              <span class="font-black ${statusColors[h.status]}">Wait: ${formatMinutesToHm(h.waitTime)}</span>
              <span class="text-slate-600">•</span>
              <span class="font-bold text-slate-400">${statusLabels[h.status]}</span>
            </div>
          `;
        }
      } else {
        if (hasDrive) {
          bottomRow = `
            <div class="flex items-center gap-1.5 mt-1.5 pt-1 border-t border-slate-800/60 text-[10px] text-slate-400">
              <span class="font-black text-cyan-400">Net: ${formatMinutesToHm((h.driveMins || 0) + h.waitTime)}</span>
              <span class="text-slate-600">•</span>
              <span>Wait: ${formatMinutesToHm(h.waitTime)}</span>
              <span class="text-slate-600">•</span>
              <span>Drive: ~${formatMinutesToHm(h.driveMins || 0)}</span>
            </div>
          `;
        } else {
          bottomRow = `
            <div class="flex items-center gap-1.5 mt-1.5 pt-1 border-t border-slate-800/60">
              <span class="font-black text-cyan-400">Wait: ${formatMinutesToHm(h.waitTime)}</span>
              <span class="text-slate-600">•</span>
              <span class="font-bold ${statusColors[h.status]}">${statusLabels[h.status]}</span>
            </div>
          `;
        }
      }

      const tooltipContent = `
        <div class="text-[11px] font-sans leading-relaxed select-none">
          <p class="font-extrabold text-white text-[12px] leading-tight mb-0.5">${h.name}</p>
          <p class="text-slate-400 font-medium">${h.city}</p>
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
    didInitialHospitalFrameRef.current = true;
    // Soft provincial pack — still readable, less dead west/east canvas.
    frameToCoords(map, coords, { maxZoom: 7, padding: [28, 28], animate: false });
  }, [hospitals, userLocation]);

  // Sync user marker; frame map only when the user location actually changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userLocation && userLocation.lat && userLocation.lng) {
      const userIcon = L.divIcon({
        html: `
          <div class="relative flex items-center justify-center" style="width: 32px; height: 32px;">
            <span class="relative inline-flex rounded-full h-4.5 w-4.5 bg-blue-500 border-2 border-white shadow-lg flex items-center justify-center">
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
          maxZoom: 12,
          padding: [40, 40],
        });
      } else {
        frameToCoords(map, [[userLocation.lat, userLocation.lng]], { maxZoom: 12 });
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

    return () => {
      resizeObserver.disconnect();
      clearTimeout(timer);
    };
  }, []);

  // Selection framing: pack selected facility + nearby peers so the canvas isn't empty.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedHospital || selectedHospital.latitude == null || selectedHospital.longitude == null) {
      return;
    }
    if (suppressSelectionPanRef.current) return;
    if (lastSelectionPanIdRef.current === selectedHospital.id) return;
    lastSelectionPanIdRef.current = selectedHospital.id;

    const selectedCoord: [number, number] = [
      selectedHospital.latitude,
      selectedHospital.longitude,
    ];

    // Prefer peers within ~35 km (city cluster). Falls back to single-pin city zoom.
    const peerCoords = hospitals
      .filter((h) => {
        if (h.id === selectedHospital.id) return false;
        if (h.latitude == null || h.longitude == null) return false;
        return (
          haversineKm(
            selectedHospital.latitude!,
            selectedHospital.longitude!,
            h.latitude,
            h.longitude,
          ) <= 35
        );
      })
      .map((h) => [h.latitude as number, h.longitude as number] as [number, number]);

    if (userLocation) {
      // Keep regional context when routing — don't snap too tight away from user.
      const local = hospitals
        .filter((h) => {
          if (h.latitude == null || h.longitude == null) return false;
          return haversineKm(userLocation.lat, userLocation.lng, h.latitude, h.longitude) <= 55;
        })
        .map((h) => [h.latitude as number, h.longitude as number] as [number, number]);
      frameToCoords(
        map,
        local.length > 0
          ? [...local, [userLocation.lat, userLocation.lng], selectedCoord]
          : [selectedCoord, [userLocation.lat, userLocation.lng]],
        { maxZoom: 12, padding: [44, 44] },
      );
      return;
    }

    frameToCoords(
      map,
      peerCoords.length > 0 ? [selectedCoord, ...peerCoords] : [selectedCoord],
      { maxZoom: peerCoords.length > 0 ? 12 : 12, padding: [40, 40] },
    );
  }, [selectedHospital, userLocation, hospitals]);

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
    </div>
  );
}
