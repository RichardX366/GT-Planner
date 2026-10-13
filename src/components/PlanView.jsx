import { useState } from 'react';
import { Check, ClipboardCopy } from 'lucide-react';
import Calendar from './Calendar.jsx';
import { GpaChip } from './CourseCard.jsx';
import { DayBoxes, StatusCell } from './FindClasses.jsx';
import { hoursOf, useCopy } from './PlanBar.jsx';
import { COURSES, SECTIONS_BY_CRN, TERM } from '../data/catalog.js';
import { defaultCriteria, usePlanner } from '../lib/store.jsx';
import { fmtRange } from '../lib/time.js';

export default function PlanView({ selected, goScheduler }) {
  const { state, plan } = usePlanner();
  const [source, setSource] = useState(plan.saved ? 'saved' : 'current');
  const [copied, copy] = useCopy();

  const sections =
    source === 'saved' && plan.saved
      ? plan.saved.crns.map((c) => SECTIONS_BY_CRN[c]).filter(Boolean)
      : selected?.sections || [];
  const combo = sections.length ? { sections } : null;
  const crns = sections.map((s) => s.crn);

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>
            {TERM} · {plan.name}
          </h1>
          <p className="muted">
            Registration plan for one-click registration when your time ticket opens.
            {plan.saved && ` Saved ${new Date(plan.saved.at).toLocaleString()}.`}
          </p>
        </div>
        <div className="seg">
          <button className={source === 'saved' ? 'on' : ''} disabled={!plan.saved} onClick={() => setSource('saved')}>
            Saved plan
          </button>
          <button className={source === 'current' ? 'on' : ''} onClick={() => setSource('current')}>
            Current selection
          </button>
        </div>
      </div>

      {!sections.length ? (
        <div className="empty-state">
          No sections yet. <a onClick={goScheduler}>Build a schedule</a> and press <b>Save Plan</b>.
        </div>
      ) : (
        <>
          <div className="oscar-table-wrap">
            <table className="oscar-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Details</th>
                  <th>Hours</th>
                  <th>CRN</th>
                  <th>Schedule Type</th>
                  <th>Instructor</th>
                  <th>Prof GPA</th>
                  <th>Meeting Times</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sections.map((s) => {
                  const c = COURSES[s.courseId];
                  const m = s.meetings[0];
                  const lead = c.primaryType === s.type;
                  return (
                    <tr key={s.crn}>
                      <td>
                        <span className="swatch" style={{ background: plan.colors[s.courseId] || '#ccc' }} />
                        {c.title}
                      </td>
                      <td>
                        {s.courseId}, {s.section}
                      </td>
                      <td>{lead ? c.hours : 0}</td>
                      <td className="mono">{s.crn}</td>
                      <td>{s.type}</td>
                      <td>{s.instructor}</td>
                      <td>{lead ? <GpaChip gpa={c.instructors[s.instructor]} /> : '—'}</td>
                      <td>
                        {m && (
                          <div className="meet">
                            <DayBoxes days={m.days} />
                            <span>{fmtRange(m.start, m.end)}</span>
                          </div>
                        )}
                      </td>
                      <td>
                        <StatusCell s={s} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="oscar-foot">
              <span>
                <b>Total Planned Hours:</b> {hoursOf(sections)}
              </span>
              <button className="btn primary" onClick={() => copy(crns.join(', '))}>
                {copied ? <Check size={15} /> : <ClipboardCopy size={15} />} {copied ? 'Copied' : 'Copy CRNs for Registration'}
              </button>
            </div>
          </div>
          <div className="plan-cal">
            <Calendar combo={combo} colors={plan.colors} criteria={defaultCriteriaOff} compact />
          </div>
        </>
      )}

      {state.order.length > 1 && (
        <section className="other-plans">
          <h2>Backup plans</h2>
          <div className="plan-cards">
            {state.order
              .filter((id) => id !== plan.id)
              .map((id) => {
                const p = state.plans[id];
                return (
                  <div key={id} className="plan-card">
                    <b>{p.name}</b>
                    <span className="muted">{p.courses.join(', ') || 'No courses'}</span>
                    <span className="muted">{p.saved ? `Saved CRNs: ${p.saved.crns.join(', ')}` : 'Not saved yet'}</span>
                  </div>
                );
              })}
          </div>
        </section>
      )}
    </main>
  );
}

const defaultCriteriaOff = (() => {
  const c = defaultCriteria();
  Object.values(c).forEach((v) => (v.on = false));
  return c;
})();
