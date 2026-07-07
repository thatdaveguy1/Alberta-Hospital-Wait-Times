// LabCard — mirrors the ER tab HospitalCard design for community labs.

import React from 'react';
import {
  MapPin,
  Clock,
  Compass,
  Navigation,
  ChevronRight,
} from 'lucide-react';
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
  return typeof lab.waitTimeMin !== 'number';
}

function waitColorClass(lab: LabCardData): string {
  if (isLabWaitUnavailable(lab)) return 'text-slate-500';
  const wait = lab.waitTimeMin as number;
  if (wait > 45) return 'text-red-400';
  if (wait > 30) return 'text-amber-400';
  if (wait > 15) return 'text-blue-400';
  return 'text-emerald-400';
}

export function LabCard({ lab, onClick, selected, sortBy = 'net-wait' }: LabCardProps): React.ReactElement {
  const isUnavailable = isLabWaitUnavailable(lab);
  const waitTime = typeof lab.waitTimeMin === 'number' ? lab.waitTimeMin : 0;
  const hasDrive = lab.distance !== undefined && lab.driveMins !== undefined;

  return (
    <div
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
        'text-left bg-slate-900/40 p-4 rounded-2xl border transition-colors flex items-center justify-between group cursor-pointer w-full gap-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50',
        selected
          ? 'border-blue-500 bg-blue-950/25 ring-4 ring-blue-500/15 shadow-xl shadow-blue-950/40'
          : isUnavailable
            ? 'border-slate-800/40 bg-slate-900/10 opacity-60 hover:opacity-85'
            : 'border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60',
      )}
    >
      <div className="space-y-1.5 flex-1 min-w-0">
        <h3 className="font-extrabold text-sm sm:text-base text-slate-100 group-hover:text-blue-400 transition-colors break-words">
          {lab.name}
        </h3>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-medium">
          <span className="flex items-center gap-1 shrink-0">
            <MapPin className="w-3.5 h-3.5 text-slate-500" />
            {lab.city}
          </span>
          <span className="w-1 h-1 bg-slate-700 rounded-full" />
          <span className="truncate">{lab.region}</span>
          <span className="w-1 h-1 bg-slate-700 rounded-full" />
          <span className="text-[10px] font-mono text-slate-500 uppercase">{lab.code}</span>
        </div>

        {/* Navigation Directions & Proximity Display */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <a
            href={`https://maps.google.com/?daddr=${encodeURIComponent(lab.name + ' ' + (lab.address || ''))}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-[10px] font-extrabold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md hover:bg-blue-500/20 hover:border-blue-500/40 transition-all shrink-0 cursor-pointer"
            title="Get driving directions in Google Maps"
          >
            <Navigation className="w-3 h-3" />
            <span>Directions</span>
          </a>

          {hasDrive && (
            <>
              <div className="flex items-center gap-1 text-[10px] font-extrabold text-slate-400 bg-slate-500/10 border border-slate-500/20 px-2 py-0.5 rounded-md shrink-0">
                <Compass className="w-3 h-3 animate-spin-slow" />
                <span>{lab.distance} km away</span>
              </div>
              {!isUnavailable && lab.driveMins !== undefined && (
                <div className="flex items-center gap-1 text-[10px] font-extrabold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md shrink-0">
                  <Clock className="w-3 h-3" />
                  <span>~{formatMinutesToHm(lab.driveMins)} drive</span>
                </div>
              )}
            </>
          )}

          {lab.walkInAvailable && (
            <span className="text-[9px] font-extrabold bg-slate-500/10 text-slate-300 border border-slate-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
              Walk-In
            </span>
          )}
          {lab.appointmentRequired && (
            <span className="text-[9px] font-extrabold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
              Appt Req
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <div className="text-right">
          {hasDrive && !isUnavailable ? (
            sortBy === 'raw-wait' ? (
              <div className="flex flex-col items-end select-none">
                {/* Stacked Math Formula with Drive & Net as helpers */}
                <div className="flex flex-col items-end text-[10px] font-mono text-slate-400 leading-none space-y-1 pb-1 mb-1.5 border-b border-slate-800/60 w-24">
                  <div className="flex justify-between w-full">
                    <span className="text-slate-500 font-bold text-[9px] uppercase tracking-wider">Drive:</span>
                    <span className="font-bold text-slate-300">~{formatMinutesToHm(lab.driveMins || 0)}</span>
                  </div>
                  <div className="flex justify-between w-full">
                    <span className="text-slate-500 font-bold text-[9px] uppercase tracking-wider">Net:</span>
                    <span className="font-bold text-slate-300">{formatMinutesToHm((lab.driveMins || 0) + waitTime)}</span>
                  </div>
                </div>

                {/* Primary spotlight is Wait Time */}
                <div className="flex flex-col items-end">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Wait Time</span>
                  <p className={cn('text-xl sm:text-2xl font-black tracking-tight leading-none font-sans', waitColorClass(lab))}>
                    {formatMinutesToHm(waitTime)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-end select-none">
                {/* Stacked Math Formula with Wait & Drive */}
                <div className="flex flex-col items-end text-[10px] font-mono text-slate-400 leading-none space-y-1 pb-1 mb-1.5 border-b border-slate-800/60 w-24">
                  <div className="flex justify-between w-full">
                    <span className="text-slate-500 font-bold text-[9px] uppercase tracking-wider">Wait:</span>
                    <span className="font-bold text-slate-300">{formatMinutesToHm(waitTime)}</span>
                  </div>
                  <div className="flex justify-between w-full">
                    <span className="text-slate-500 font-bold text-[9px] uppercase tracking-wider">Drive:</span>
                    <span className="font-bold text-slate-300">+{formatMinutesToHm(lab.driveMins || 0)}</span>
                  </div>
                </div>

                {/* Primary spotlight is Net Time */}
                <div className="flex flex-col items-end">
                  <span className="text-[8px] font-black text-cyan-400/90 uppercase tracking-widest leading-none mb-1">Net Time</span>
                  <p className="text-xl sm:text-2xl font-black tracking-tight text-cyan-200 leading-none font-sans">
                    {formatMinutesToHm((lab.driveMins || 0) + waitTime)}
                  </p>
                </div>
              </div>
            )
          ) : (
            <>
              <p className={cn('text-lg sm:text-xl font-black tracking-tight leading-none', isUnavailable ? 'text-slate-500' : waitColorClass(lab))}>
                {isUnavailable ? 'Unavailable' : formatMinutesToHm(waitTime)}
              </p>
              {!isUnavailable && <p className="text-[8px] font-extrabold text-slate-500 uppercase tracking-widest mt-1">Wait Time</p>}
            </>
          )}
        </div>
        <ChevronRight
          className={cn(
            'w-5 h-5 transition-transform duration-300',
            selected ? 'translate-x-1 text-blue-400' : 'text-slate-600 group-hover:text-slate-400',
          )}
        />
      </div>
    </div>
  );
}
