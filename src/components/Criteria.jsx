import { Plus, RotateCcw, X } from 'lucide-react';
import { defaultCriteria, toggleIn, usePlanner } from '../lib/store.jsx';
import { DAYS, fromInput, toInput } from '../lib/time.js';
import { useData } from '../lib/data.jsx';

export default function Criteria({ result }) {
  const { plan, updatePlan } = usePlanner();
  const { catalog } = useData();
  const c = plan.criteria;
  const set = (key, patch) =>
    updatePlan((p) => ({ criteria: { ...p.criteria, [key]: { ...p.criteria[key], ...patch } }, selectedKey: null }));

  const impact = (key) =>
    c[key].on && result.total ? (
      <span className="impact">
        rules out {result.impact[key] || 0}/{result.total}
      </span>
    ) : null;

  const bannedCount =
    plan.excluded.length + Object.values(plan.bannedInstructors).reduce((a, l) => a + l.length, 0);
  const forcedCount = plan.pinned.length + Object.values(plan.forcedInstructors).reduce((a, l) => a + l.length, 0);

  return (
    <div className="criteria">
      <p className="criteria-intro">
        Tell the planner what you care about. Schedules that meet <b>every</b> rule are listed as matches. When none
        can, the closest <b>backup schedules</b> are shown with the rules they break.
      </p>

      <Rule title="Campus" on={c.campus.on} onToggle={(on) => set('campus', { on })}>
        <select value={c.campus.value} onChange={(e) => set('campus', { value: e.target.value })}>
          {catalog.campuses.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </Rule>

      <Rule title="No classes before" on={c.earliestStart.on} onToggle={(on) => set('earliestStart', { on })} extra={impact('earliestStart')}>
        <input type="time" step="900" value={toInput(c.earliestStart.value)} onChange={(e) => set('earliestStart', { value: fromInput(e.target.value) })} />
      </Rule>

      <Rule title="No classes after" on={c.latestEnd.on} onToggle={(on) => set('latestEnd', { on })} extra={impact('latestEnd')}>
        <input type="time" step="900" value={toInput(c.latestEnd.value)} onChange={(e) => set('latestEnd', { value: fromInput(e.target.value) })} />
      </Rule>

      <Rule title="Keep these days free" on={c.daysOff.on} onToggle={(on) => set('daysOff', { on })} extra={impact('daysOff')}>
        <DayPicker value={c.daysOff.days} onChange={(days) => set('daysOff', { days })} />
      </Rule>

      <Rule title="Seat availability" on={c.seats.on} onToggle={(on) => set('seats', { on })} extra={impact('seats')}>
        <select value={c.seats.mode} onChange={(e) => set('seats', { mode: e.target.value })}>
          <option value="open">Open seats only</option>
          <option value="waitlist">Allow open waitlists</option>
        </select>
      </Rule>

      <Rule title="Minimum professor GPA" on={c.minGpa.on} onToggle={(on) => set('minGpa', { on })} extra={impact('minGpa')}>
        <div className="slider">
          <input type="range" min="2.0" max="3.8" step="0.05" value={c.minGpa.value} onChange={(e) => set('minGpa', { value: Number(e.target.value) })} />
          <b>{c.minGpa.value.toFixed(2)}</b>
        </div>
      </Rule>

      <Rule title="Blocked times" on={c.blocked.on} onToggle={(on) => set('blocked', { on })} extra={impact('blocked')}>
        <div className="blocks">
          {c.blocked.items.map((b) => {
            const upd = (patch) => set('blocked', { items: c.blocked.items.map((x) => (x.id === b.id ? { ...x, ...patch } : x)) });
            return (
              <div key={b.id} className="block-item">
                <div className="block-top">
                  <input className="block-label" value={b.label} placeholder="Label (e.g. Work)" onChange={(e) => upd({ label: e.target.value })} />
                  <button className="icon-btn sm" title="Remove" onClick={() => set('blocked', { items: c.blocked.items.filter((x) => x.id !== b.id) })}>
                    <X size={13} />
                  </button>
                </div>
                <DayPicker value={b.days.split('')} onChange={(days) => upd({ days: DAYS.filter((d) => days.includes(d)).join('') })} />
                <div className="block-times">
                  <input type="time" step="900" value={toInput(b.start)} onChange={(e) => upd({ start: fromInput(e.target.value) })} />
                  <span>to</span>
                  <input type="time" step="900" value={toInput(b.end)} onChange={(e) => upd({ end: fromInput(e.target.value) })} />
                </div>
              </div>
            );
          })}
          <button
            className="btn ghost sm"
            onClick={() =>
              set('blocked', {
                items: [...c.blocked.items, { id: Math.random().toString(36).slice(2, 8), label: '', days: 'MW', start: 15 * 60, end: 17 * 60 }],
              })
            }
          >
            <Plus size={13} /> Add blocked time
          </button>
        </div>
      </Rule>

      <div className="criteria-summary">
        <div>
          <b>{forcedCount}</b> forced (pinned sections / starred profs)
        </div>
        <div>
          <b>{bannedCount}</b> banned (sections / profs)
        </div>
        <div className="row-gap">
          <button className="btn ghost sm" onClick={() => updatePlan(() => ({ criteria: defaultCriteria(), selectedKey: null }))}>
            <RotateCcw size={13} /> Reset rules
          </button>
          <button
            className="btn ghost sm"
            disabled={!bannedCount && !forcedCount}
            onClick={() => updatePlan(() => ({ pinned: [], excluded: [], bannedInstructors: {}, forcedInstructors: {}, selectedKey: null }))}
          >
            Clear pins &amp; bans
          </button>
        </div>
      </div>
    </div>
  );
}

function Rule({ title, on, onToggle, extra, children }) {
  return (
    <div className={`rule ${on ? 'on' : ''}`}>
      <div className="rule-head">
        <span>{title}</span>
        {extra}
        <Switch on={on} onChange={onToggle} />
      </div>
      <div className="rule-body">{children}</div>
    </div>
  );
}

export function Switch({ on, onChange }) {
  return (
    <button className={`switch ${on ? 'on' : ''}`} role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

function DayPicker({ value, onChange }) {
  return (
    <div className="daypicker">
      {DAYS.map((d) => (
        <button key={d} className={value.includes(d) ? 'on' : ''} onClick={() => onChange(toggleIn(value, d))}>
          {d}
        </button>
      ))}
    </div>
  );
}
