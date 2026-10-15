import { AlertTriangle, CheckCircle2, LifeBuoy, Loader2 } from 'lucide-react';
import { MiniCalendar } from './Calendar.jsx';
import { GpaChip } from './CourseCard.jsx';
import { usePlanner } from '../lib/store.jsx';
import { CRITERIA_LABELS, SORTS } from '../lib/scheduler.js';

export default function Combinations({ result, hasResult, pending, selected, select, setHoverKey }) {
  const { plan, updatePlan } = usePlanner();
  const { matches, backups } = result;

  const item = (c, i, backup) => (
    <button
      key={c.key}
      className={`combo ${selected?.key === c.key ? 'selected' : ''} ${backup ? 'backup' : ''}`}
      onClick={() => select(c)}
      onMouseEnter={() => setHoverKey(c.key)}
      onMouseLeave={() => setHoverKey(null)}
    >
      <div className="combo-index">{backup ? `B${i + 1}` : i + 1}</div>
      <div className="combo-main">
        <MiniCalendar combo={c} colors={plan.colors} />
        <div className="combo-stats">
          <span title="Credit-weighted professor GPA">
            GPA <GpaChip gpa={c.gpa} />
          </span>
          <span title="Days on campus">{c.days}d</span>
          <span title="Total gap time between classes">{Math.round(c.gaps / 6) / 10}h gaps</span>
        </div>
        {backup && (
          <div className="combo-viol">
            {c.violations.map((v) => (
              <span key={v.key} className="viol" title={v.text}>
                {CRITERIA_LABELS[v.key]}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );

  return (
    <aside className="combos">
      <div className="combos-head">
        <div className="combos-title">
          Schedule Combinations
          <span className={`updating ${pending ? 'on' : ''}`} title="Recalculating in the background">
            <Loader2 size={13} className="spin" /> Updating
          </span>
        </div>
        <select value={plan.sortBy} onChange={(e) => updatePlan(() => ({ sortBy: e.target.value }))}>
          {Object.entries(SORTS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button
          className="link-btn"
          disabled={!plan.pinned.length && !plan.excluded.length}
          onClick={() => updatePlan(() => ({ pinned: [], excluded: [], selectedKey: null }))}
        >
          Reset Sections
        </button>
      </div>

      <div className={`combos-scroll ${pending ? 'stale' : ''}`}>
        {!hasResult && pending && (
          <div className="notice ok">
            <Loader2 size={15} className="spin" />
            <div>Calculating schedules…</div>
          </div>
        )}
        {hasResult && result.emptyCourses.length > 0 && (
          <div className="notice danger">
            <AlertTriangle size={15} />
            <div>
              <b>{result.emptyCourses.join(', ')}</b> has no sections left. Sections with no set meeting time and at
              other campuses aren’t scheduled; otherwise unban a section or professor to continue.
            </div>
          </div>
        )}
        {hasResult && !result.emptyCourses.length && plan.courses.length > 0 && !matches.length && !backups.length && (
          <div className="notice danger">
            <AlertTriangle size={15} />
            <div>Every combination has a time conflict. Try removing a course or unpinning a section.</div>
          </div>
        )}

        {matches.length + backups.length > 0 && (
          <div className={`notice ${matches.length ? 'ok' : 'warn'}`}>
            {matches.length ? <CheckCircle2 size={15} /> : <LifeBuoy size={15} />}
            <div>
              {matches.length ? (
                <>These schedules meet all your rules.</>
              ) : (
                <>
                  No schedule meets every rule. Showing <b>backup schedules</b> that break the fewest.
                </>
              )}
              {result.truncated && ' (search stopped early)'}
            </div>
          </div>
        )}

        {matches.map((c, i) => item(c, i, false))}

        {backups.length > 0 && (
          <>
            <div className="combos-sub">Backup schedules</div>
            {backups.map((c, i) => item(c, i, true))}
          </>
        )}
      </div>
      <div className="combos-foot">↑ / ↓ to flip through schedules</div>
    </aside>
  );
}
