import React, { useEffect, useState } from 'react';
import { isRoughlyInAlberta, type UserLocation } from '../lib/geo';

/** Shared sessionStorage key — dismiss once per tab session across Home / ER / labs. */
export const LOCATION_UNAVAILABLE_DISMISS_KEY =
  'alberta_hospital_location_unavailable_dismissed';

export function isLocationUnavailableDismissed(): boolean {
  try {
    return sessionStorage.getItem(LOCATION_UNAVAILABLE_DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissLocationUnavailableModal(): void {
  try {
    sessionStorage.setItem(LOCATION_UNAVAILABLE_DISMISS_KEY, '1');
  } catch {
    // sessionStorage may be unavailable (private mode / SSR).
  }
}

/**
 * Show when a pin exists outside Alberta and the user has not dismissed this session.
 * No location → false (Home keeps the Use-my-location CTA instead).
 */
export function shouldShowLocationUnavailableModal(
  location: Pick<UserLocation, 'lat' | 'lng'> | null | undefined,
): boolean {
  if (!location) return false;
  if (isRoughlyInAlberta(location.lat, location.lng)) return false;
  return !isLocationUnavailableDismissed();
}

/** Hook: open state + dismiss that persists for the browser tab session. */
export function useLocationUnavailableModal(
  location: Pick<UserLocation, 'lat' | 'lng'> | null | undefined,
): { open: boolean; dismiss: () => void } {
  const [open, setOpen] = useState(() => shouldShowLocationUnavailableModal(location));

  useEffect(() => {
    setOpen(shouldShowLocationUnavailableModal(location));
  }, [location?.lat, location?.lng]);

  const dismiss = () => {
    dismissLocationUnavailableModal();
    setOpen(false);
  };

  return { open, dismiss };
}

type LocationUnavailableModalProps = {
  open: boolean;
  onDismiss: () => void;
};

/**
 * Compact centered dialog: drive times are Alberta-only; lists fall back to wait.
 */
export function LocationUnavailableModal({
  open,
  onDismiss,
}: LocationUnavailableModalProps): React.ReactElement | null {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-unavailable-title"
      aria-describedby="location-unavailable-body"
    >
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute inset-0 bg-ink/30 cursor-default"
        onClick={onDismiss}
        tabIndex={-1}
      />
      <div className="relative w-full max-w-sm rounded-xl border border-line bg-surface p-5 shadow-md">
        <h2
          id="location-unavailable-title"
          className="text-base font-semibold text-ink"
        >
          Location unavailable
        </h2>
        <p id="location-unavailable-body" className="mt-2 text-sm text-ink-2">
          We can’t use drive times outside Alberta, so lists show wait times only.
        </p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

export default LocationUnavailableModal;
