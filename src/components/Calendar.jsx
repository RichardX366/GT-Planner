import { useData } from '../lib/data.jsx';
import { DAYS, daysOf, fmtHour, fmtRange } from '../lib/time.js';

const HOUR_PX = 58;

function rangeFor(combo, criteria, ghost) {
  let lo = 8;
  let hi = 18;
  [...(combo?.sections || []), ...(ghost ? [ghost] : [])].forEach((s) =>
    s.meetings.forEach((m) => {
      lo = Math.min(lo, Math.floor(m.start / 60));
      hi = Math.max(hi, Math.ceil(m.end / 60));
    })
  );
  if (criteria.blocked.on)
    criteria.blocked.items.forEach((b) => {
      lo = Math.min(lo, Math.floor(b.start / 60));
      hi = Math.max(hi, Math.ceil(b.end / 60));
    });
  return [lo, hi];
}

/**
 * ghost: a section being hovered in the course list. It's drawn as a light, dashed
 * preview, and the section it would replace (same course + type) is dimmed.
 */
export default function Calendar({ combo, colors, criteria, preview, ghost = null, compact = false }) {
  const { catalog } = useData();
  const [lo, hi] = rangeFor(combo, criteria, ghost);
  const ghostInSchedule = ghost && combo?.sections.some((s) => s.crn === ghost.crn);
  const replaced = (s) => ghost && !ghostInSchedule && s.courseId === ghost.courseId && s.type === ghost.type;
  const hours = Array.from({ length: hi - lo }, (_, i) => lo + i);
  const hourPx = compact ? 44 : HOUR_PX;
  const y = (min) => ((min - lo * 60) / 60) * hourPx;
  const height = (hi - lo) * hourPx;

  const blocks = criteria.blocked.on ? criteria.blocked.items : [];
  const offDays = criteria.daysOff.on ? criteria.daysOff.days : [];

  return (
    <div className={`calendar ${preview ? 'previewing' : ''}`}>
      <div className="cal-head">
        <div className="cal-gutter" />
        {DAYS.map((d) => (
          <div key={d} className={`cal-day-name ${offDays.includes(d) ? 'off' : ''}`}>
            {d}
          </div>
        ))}
      </div>
      <div className="cal-body" style={{ height }}>
        <div className="cal-gutter">
          {hours.map((h) => (
            <div key={h} className="cal-hour" style={{ height: hourPx }}>
              {fmtHour(h)}
            </div>
          ))}
        </div>
        {DAYS.map((d) => (
          <div key={d} className={`cal-col ${offDays.includes(d) ? 'off' : ''}`}>
            {hours.map((h) => (
              <div key={h} className="cal-cell" style={{ height: hourPx }} />
            ))}
            {criteria.earliestStart.on && criteria.earliestStart.value > lo * 60 && (
              <div className="cal-shade" style={{ top: 0, height: y(criteria.earliestStart.value) }} />
            )}
            {criteria.latestEnd.on && criteria.latestEnd.value < hi * 60 && (
              <div className="cal-shade" style={{ top: y(criteria.latestEnd.value), bottom: 0 }} />
            )}
            {blocks
              .filter((b) => daysOf(b.days).includes(d))
              .map((b) => (
                <div key={b.id} className="cal-blocked" style={{ top: y(b.start), height: y(b.end) - y(b.start) }}>
                  {b.label}
                </div>
              ))}
            {combo?.sections.flatMap((s) =>
              s.meetings
                .filter((m) => daysOf(m.days).includes(d))
                .map((m, i) => {
                  const course = catalog.courses[s.courseId];
                  return (
                    <div
                      key={s.crn + i}
                      className={`cal-event ${replaced(s) ? 'replaced' : ''} ${ghostInSchedule && s.crn === ghost.crn ? 'hovered' : ''}`}
                      style={{ top: y(m.start), height: y(m.end) - y(m.start), '--c': colors[s.courseId] }}
                      title={`${s.courseId} ${s.section} · ${course?.title ?? ''}\n${s.type} · CRN ${s.crn}\n${s.instructor}\n${m.location}`}
                    >
                      <div className="ev-id">
                        {s.courseId} {s.section}
                      </div>
                      <div className="ev-line">{fmtRange(m.start, m.end)}</div>
                      <div className="ev-line">{m.location}</div>
                      <div className="ev-line">{s.instructor}</div>
                    </div>
                  );
                })
            )}
            {ghost &&
              !ghostInSchedule &&
              ghost.meetings
                .filter((m) => daysOf(m.days).includes(d))
                .map((m, i) => (
                  <div
                    key={`ghost${i}`}
                    className="cal-ghost"
                    style={{ top: y(m.start), height: y(m.end) - y(m.start), '--c': colors[ghost.courseId] || '#cfd8dc' }}
                  >
                    <div className="ev-id">
                      {ghost.courseId} {ghost.section}
                    </div>
                    <div className="ev-line">{fmtRange(m.start, m.end)}</div>
                    <div className="ev-line">{m.location}</div>
                    <div className="ev-line">{ghost.instructor}</div>
                  </div>
                ))}
          </div>
        ))}
      </div>
      {!combo && <div className="cal-empty">Add courses to see possible schedules.</div>}
    </div>
  );
}

/** Tiny bar preview of a combination, like gt-scheduler's combination list. */
export function MiniCalendar({ combo, colors }) {
  const lo = 8 * 60;
  const span = 12 * 60;
  return (
    <div className="mini-cal">
      {DAYS.map((d) => (
        <div key={d} className="mini-col">
          {combo.sections.flatMap((s) =>
            s.meetings
              .filter((m) => daysOf(m.days).includes(d))
              .map((m, i) => (
                <div
                  key={s.crn + i}
                  className="mini-ev"
                  style={{
                    top: `${((m.start - lo) / span) * 100}%`,
                    height: `${((m.end - m.start) / span) * 100}%`,
                    background: colors[s.courseId],
                  }}
                />
              ))
          )}
        </div>
      ))}
    </div>
  );
}
