import { Eye, EyeOff } from 'lucide-react';
import { usePlanner } from '../lib/store.jsx';

export const SEAT_KINDS = [
  ['open', 'Open', 'Seats available'],
  ['waitlist', 'Waitlist', 'Full, waitlist has room'],
  ['full', 'Full', 'Full, waitlist full or closed'],
  ['unknown', 'Unknown', 'Loading or unavailable'],
];

// Chips in the "Show sections" filter. Time conflicts are hidden by default.
const FILTERS = [
  ['open', 'Open', 'sections with open seats'],
  ['waitlist', 'Waitlist', 'full sections with waitlist room'],
  ['full', 'Full', 'full sections'],
  ['conflict', 'Conflicts', 'sections that conflict with your other courses'],
];
const DEFAULT = { open: true, waitlist: true, full: true, conflict: false };
const ALL_ON = { open: true, waitlist: true, full: true, conflict: true };

export function useSeatFilter() {
  const { state, setState } = usePlanner();
  const filter = { ...DEFAULT, ...state.seatFilter, unknown: true };
  const toggle = (kind) => setState((s) => ({ ...s, seatFilter: { ...DEFAULT, ...s.seatFilter, [kind]: !filter[kind] } }));
  const showAll = () => setState((s) => ({ ...s, seatFilter: ALL_ON }));
  return { filter, toggle, showAll, anyHidden: FILTERS.some(([k]) => !filter[k]) };
}

/** Yes/no toggles for which sections are listed in the course cards. */
export function SeatFilter() {
  const { filter, toggle, showAll, anyHidden } = useSeatFilter();
  return (
    <div className="seat-filter">
      <div className="seat-filter-head">
        <span>Show sections</span>
        {anyHidden && (
          <button className="link-btn" onClick={showAll}>
            Show all
          </button>
        )}
      </div>
      <div className="seat-filter-chips">
        {FILTERS.map(([kind, label, desc]) => (
          <button
            key={kind}
            className={`seat-chip ${filter[kind] ? 'on' : 'off'}`}
            aria-pressed={filter[kind]}
            title={`${filter[kind] ? 'Hide' : 'Show'} ${desc}`}
            onClick={() => toggle(kind)}
          >
            {kind === 'conflict' ? <span className="hatch-swatch" /> : <span className={`seat-dot ${kind}`} />}
            {label}
            {filter[kind] ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SeatLegend() {
  return (
    <div className="seat-legend">
      <div className="seat-legend-title">Key</div>
      {SEAT_KINDS.map(([kind, label, desc]) => (
        <div key={kind} className="seat-legend-row">
          <span className={`seat-dot ${kind}`} />
          <b>{label}</b>
          <span>{desc}</span>
        </div>
      ))}
      <div className="seat-legend-row">
        <span className="hatch-swatch" />
        <b>Conflict</b>
        <span>Can’t fit with your other courses</span>
      </div>
    </div>
  );
}
