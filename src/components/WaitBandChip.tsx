// Shared wait-band status chip — semantic color always paired with a text label.
import { waitBandLabel, type WaitBand } from '../lib/erFacility';
import { cn } from '../lib/utils';

const TONE: Record<WaitBand, string> = {
  low: 'bg-ok-soft text-ok',
  moderate: 'bg-warn-soft text-warn',
  high: 'bg-crit-soft text-crit',
  closed: 'bg-neutral-chip text-ink-3',
  unavailable: 'bg-neutral-chip text-ink-3',
};

export function WaitBandChip({ band, className }: { band: WaitBand; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        TONE[band],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {waitBandLabel(band)}
    </span>
  );
}
