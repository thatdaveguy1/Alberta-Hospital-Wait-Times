import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes with clsx + tailwind-merge. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format minutes as an h:mm string (matches ER page display). */
export function formatMinutesToHm(minutes: number): string {
  if (typeof minutes !== 'number' || isNaN(minutes)) return '0:00';
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h}:${min.toString().padStart(2, '0')}`;
}
