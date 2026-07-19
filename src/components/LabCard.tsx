// LabCard — mirrors the ER tab FacilityRow design for community labs.

import React from 'react';
import { MapPin, Clock, Compass, Navigation, ChevronRight } from 'lucide-react';
import { cn, formatMinutesToHm } from '../lib/utils';

export interface LabCardData {
  id: string;
  name: string;
  city: string;
  region: string;
  address?: string;
  distance?: number;
  driveMins?: number;
  waitTimeMin: number | 'Appointments Only' | 'Closed';
  code: string;
  walkInAvailable: boolean;
  appointmentRequired: boolean;
  saveMyPlaceAvailable: boolean;
}

interface LabCardProps {
  lab: LabCardData;
  onClick: () => void;
  selected: boolean;
  sortBy?: 'net-wait' | 'proximity' | 'raw-wait';
  key?: React.Key;
}

function isLabWaitUnavailable(lab: LabCardData): boolean {
  if (lab.waitTimeMin === 'Closed' || lab.waitTimeMin === 'Appointments Only') return true;
  if (typeof lab.waitTimeMin === 'number') {
    return lab.waitTimeMin === 0 && !lab.walkInAvailable;
  }
  return true;
}

function unavailableWaitLabel(lab: LabCardData): string {
  if (lab.waitTimeMin === 'Closed' || lab.waitTimeMin === 'Appointments Only') {
    return lab.waitTimeMin;
  }
  if (typeof lab.waitTimeMin === 'number' && lab.waitTimeMin === 0 && !lab.walkInAvailable) {
    return 'Closed';
  }
  return 'Unavailable';
}


export function LabCard({ lab, onClick, selected, sortBy = 'net-wait' }: LabCardProps): React.ReactElement {
  const isUnavailable = isLabWaitUnavailable(lab);
  const isAppointmentsOnly = lab.waitTimeMin === 'Appointments Only';
  const isClosed = lab.waitTimeMin === 'Closed';
  const waitTime = typeof lab.waitTimeMin === 'number' ? lab.waitTimeMin : 0;
  const hasDrive = lab.distance !== undefined && lab.driveMins !== undefined;
  let waitTone = 'text-ink-3';
  if (!isUnavailable && typeof lab.waitTimeMin === 'number') {
    if (lab.waitTimeMin > 45) waitTone = 'text-crit';
    else if (lab.waitTimeMin > 30) waitTone = 'text-warn';
    else if (lab.waitTimeMin > 15) waitTone = 'text-accent';
    else waitTone = 'text-ok';
  }

  return (
    <div
      data-testid="lab-card"
      data-lab-id={lab.id}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'group flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl border p-4 text-left transition-colors focus:outline-none',
        selected
          ? 'border-accent bg-accent-soft ring-2 ring-accent/30'
          : isUnavailable
            ? 'border-line bg-surface opacity-70 hover:bg-paper'
            : 'border-line bg-surface hover:bg-paper',
      )}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <h3 className="break-words text-sm font-semibold text-ink">
          {lab.name}
        </h3>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
          <span className="flex shrink-0 items-center gap-1">
            <MapPin className="h-3.5 w-3.5 text-ink-3" aria-hidden />
            {lab.city}
          </span>
          <span className="text-ink-3" aria-hidden>•</span>
          <span className="truncate">{lab.region}</span>
          <span className="text-ink-3" aria-hidden>•</span>
          <span className="font-mono">{lab.code}</span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <a
            href={`https://maps.google.com/?daddr=${encodeURIComponent(lab.name + ' ' + (lab.address || ''))}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line-2 bg-surface px-2 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent-soft"
            title="Get driving directions in Google Maps"
          >
            <Navigation className="h-3 w-3" aria-hidden />
            <span>Directions</span>
          </a>

          {hasDrive && (
            <>
              <div className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line-2 bg-surface px-2 py-1.5 text-xs font-medium text-ink-2">
                <Compass className="h-3 w-3 text-ink-3" aria-hidden />
                <span>{lab.distance} km away</span>
              </div>
              {!isUnavailable && lab.driveMins !== undefined && (
                <div className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line-2 bg-surface px-2 py-1.5 text-xs font-medium text-ink-2">
                  <Clock className="h-3 w-3 text-ink-3" aria-hidden />
                  <span>~{formatMinutesToHm(lab.driveMins)} drive</span>
                </div>
              )}
            </>
          )}

          {lab.walkInAvailable && !isUnavailable && !isAppointmentsOnly && (
            <span className="inline-flex shrink-0 items-center rounded-full bg-neutral-chip px-2 py-0.5 text-xs font-medium text-ink-2">
              Walk-In
            </span>
          )}
          {(lab.appointmentRequired || isAppointmentsOnly) && (
            <span className="inline-flex shrink-0 items-center rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-strong">
              Appt Req
            </span>
          )}
          {isClosed && (
            <span className="inline-flex shrink-0 items-center rounded-full bg-crit-soft px-2 py-0.5 text-xs font-medium text-crit">
              Closed
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <div className="text-right">
          {hasDrive && !isUnavailable ? (
            sortBy === 'raw-wait' ? (
              <div className="flex flex-col items-end select-none">
                <div className="mb-1.5 flex w-full flex-col items-end space-y-1 border-b border-line pb-1.5">
                  <div className="flex w-full justify-between gap-4">
                    <span className="text-xs text-ink-3">Drive</span>
                    <span className="font-mono text-xs tabular-nums text-ink-2">
                      ~{formatMinutesToHm(lab.driveMins || 0)}
                    </span>
                  </div>
                  <div className="flex w-full justify-between gap-4">
                    <span className="text-xs text-ink-3">Net</span>
                    <span className="font-mono text-xs tabular-nums text-ink-2">
                      {formatMinutesToHm((lab.driveMins || 0) + waitTime)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="mb-0.5 text-xs text-ink-3">Wait Time</span>
                  <p className={cn('font-mono text-xl tabular-nums leading-none', waitTone)}>
                    {formatMinutesToHm(waitTime)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-end select-none">
                <div className="mb-1.5 flex w-full flex-col items-end space-y-1 border-b border-line pb-1.5">
                  <div className="flex w-full justify-between gap-4">
                    <span className="text-xs text-ink-3">Wait</span>
                    <span className="font-mono text-xs tabular-nums text-ink-2">
                      {formatMinutesToHm(waitTime)}
                    </span>
                  </div>
                  <div className="flex w-full justify-between gap-4">
                    <span className="text-xs text-ink-3">Drive</span>
                    <span className="font-mono text-xs tabular-nums text-ink-2">
                      +{formatMinutesToHm(lab.driveMins || 0)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="mb-0.5 text-xs text-ink-3">Net Time</span>
                  <p className={cn('font-mono text-xl tabular-nums leading-none', waitTone)}>
                    {formatMinutesToHm((lab.driveMins || 0) + waitTime)}
                  </p>
                </div>
              </div>
            )
          ) : (
            <>
              <p className={cn('font-mono text-xl tabular-nums leading-none', waitTone)}>
                {isUnavailable ? unavailableWaitLabel(lab) : formatMinutesToHm(waitTime)}
              </p>
              {!isUnavailable && <p className="mt-0.5 text-xs text-ink-3">Wait Time</p>}
            </>
          )}
        </div>
        <ChevronRight
          className={cn(
            'h-5 w-5 transition-transform duration-300',
            selected ? 'translate-x-1 text-accent' : 'text-ink-3 group-hover:text-accent',
          )}
        />
      </div>
    </div>
  );
}
