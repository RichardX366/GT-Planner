import { useEffect } from 'react';
import { Check, ClipboardCopy } from 'lucide-react';
import Calendar from './Calendar.jsx';
import { GpaChip } from './CourseCard.jsx';
import { Meetings, StatusCell } from './FindClasses.jsx';
import { hoursOf, useCopy } from './PlanBar.jsx';
import { useData } from '../lib/data.jsx';
import { termLabel } from '../lib/api.js';
import { isLead } from '../lib/scheduler.js';
import { defaultCriteria, usePlanner } from '../lib/store.jsx';

export default function PlanView({ selected, goScheduler }) {
  const { state, plan } = usePlanner();
  const { term, catalog, seats, requestSeats, requestGpa, instructorGpa } = useData();
  const [copied, copy] = useCopy();

  const sections = selected?.sections || [];
  const combo = sections.length ? { sections } : null;
  const crns = sections.map((s) => s.crn);

  useEffect(() => {
    requestSeats(crns);
    requestGpa([...new Set(sections.map((s) => s.courseId))]);
  }, [crns.join()]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>
            {termLabel(term)} · {plan.name}
          </h1>
          <p className="muted">
            Registration plan for one-click registration when your time ticket opens.
            {plan.saved && ` Autosaved ${new Date(plan.saved.at).toLocaleString()}.`}
          </p>
        </div>
      </div>

      {!sections.length ? (
        <div className="empty-state">
          No sections yet. <a onClick={goScheduler}>Build a schedule</a> — it’s saved automatically.
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
                  const c = catalog.courses[s.courseId];
                  const lead = isLead(c, s);
                  return (
                    <tr key={s.crn}>
                      <td>
                        <span className="swatch" style={{ background: plan.colors[s.courseId] || '#ccc' }} />
                        {c.title}
                      </td>
                      <td>
                        {s.courseId}, {s.section}
                      </td>
                      <td>{s.hours}</td>
                      <td className="mono">{s.crn}</td>
                      <td>{s.type}</td>
                      <td>{s.instructor}</td>
                      <td>{lead ? <GpaChip gpa={instructorGpa(s.courseId, s.instructor)} /> : '—'}</td>
                      <td>
                        <Meetings s={s} />
                      </td>
                      <td>
                        <StatusCell seat={seats[s.crn]} />
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

      {state.order.filter((id) => state.plans[id].term === term).length > 1 && (
        <section className="other-plans">
          <h2>Backup plans</h2>
          <div className="plan-cards">
            {state.order
              .filter((id) => id !== plan.id && state.plans[id].term === term)
              .map((id) => {
                const p = state.plans[id];
                return (
                  <div key={id} className="plan-card">
                    <b>{p.name}</b>
                    <span className="muted">{p.courses.join(', ') || 'No courses'}</span>
                    <span className="muted">{p.saved?.crns.length ? `CRNs: ${p.saved.crns.join(', ')}` : 'No schedule yet'}</span>
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
