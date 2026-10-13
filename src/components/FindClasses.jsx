import { Fragment, useMemo, useState } from 'react';
import { AlertCircle, Check, ChevronDown, ChevronRight, Link2, Pin, Plus, Search } from 'lucide-react';
import { GpaChip } from './CourseCard.jsx';
import { useAddCourse } from './CourseAdd.jsx';
import { ATTRIBUTES, COURSES, SUBJECTS, TERM } from '../data/catalog.js';
import { seatStatus } from '../lib/scheduler.js';
import { nextColor, usePlanner } from '../lib/store.jsx';
import { fmtRange } from '../lib/time.js';

const empty = { subject: '', number: '', keyword: '', instructor: '', attribute: '', openOnly: false };

export default function FindClasses() {
  const [form, setForm] = useState(empty);
  const [query, setQuery] = useState(null);
  const [advanced, setAdvanced] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const results = useMemo(() => {
    if (!query) return [];
    const kw = query.keyword.trim().toLowerCase();
    const ins = query.instructor.trim().toLowerCase();
    return Object.values(COURSES).filter(
      (c) =>
        (!query.subject || c.subject === query.subject) &&
        (!query.number || c.number.startsWith(query.number.trim())) &&
        (!kw || c.title.toLowerCase().includes(kw) || c.description.toLowerCase().includes(kw)) &&
        (!ins || Object.keys(c.instructors).some((n) => n.toLowerCase().includes(ins))) &&
        (!query.attribute || c.attributes.includes(query.attribute)) &&
        (!query.openOnly || c.sections.some((s) => seatStatus(s).kind === 'open'))
    );
  }, [query]);

  const submit = (e) => {
    e.preventDefault();
    setQuery(form);
    setExpanded(null);
  };

  return (
    <main className="page">
      <form className="search-card" onSubmit={submit}>
        <h1>Find Classes</h1>
        <p className="muted">Term: {TERM}</p>
        <div className="search-grid">
          <label>
            Subject
            <select value={form.subject} onChange={set('subject')}>
              <option value="">Any subject</option>
              {Object.entries(SUBJECTS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v} ({k})
                </option>
              ))}
            </select>
          </label>
          <label>
            Course Number
            <input value={form.number} onChange={set('number')} placeholder="e.g. 1332" />
          </label>
          <label className="wide">
            Keyword
            <input value={form.keyword} onChange={set('keyword')} placeholder="Title or description, e.g. algorithms" />
          </label>
          {advanced && (
            <>
              <label>
                Instructor
                <input value={form.instructor} onChange={set('instructor')} placeholder="Name" />
              </label>
              <label>
                Attribute
                <select value={form.attribute} onChange={set('attribute')}>
                  <option value="">Any attribute</option>
                  {ATTRIBUTES.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </label>
              <label className="check">
                <input type="checkbox" checked={form.openOnly} onChange={set('openOnly')} /> Only courses with open seats
              </label>
            </>
          )}
        </div>
        <div className="search-actions">
          <button className="btn primary" type="submit">
            <Search size={15} /> Search
          </button>
          <button
            className="link-btn"
            type="button"
            onClick={() => {
              setForm(empty);
              setQuery(null);
            }}
          >
            Clear
          </button>
          <button className="link-btn" type="button" onClick={() => setAdvanced((a) => !a)}>
            {advanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Advanced Search
          </button>
        </div>
      </form>

      {query && (
        <div className="results">
          <div className="results-head">
            <b>Search Results — {results.length} Courses</b>
            <span className="muted">
              Term: {TERM}
              {query.subject && ` · Subject: ${SUBJECTS[query.subject]}`}
              {query.number && ` · Course Number: ${query.number}`}
            </span>
          </div>
          <div className="oscar-table-wrap">
            <table className="oscar-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Subject</th>
                  <th>Course</th>
                  <th>Hours</th>
                  <th>Avg GPA</th>
                  <th>Description</th>
                  <th>Sections</th>
                  <th>Add Course</th>
                </tr>
              </thead>
              <tbody>
                {results.map((c) => (
                  <Fragment key={c.id}>
                    <tr>
                      <td>
                        <a onClick={() => setExpanded(expanded === c.id ? null : c.id)}>{c.title}</a>
                      </td>
                      <td>{c.subjectName}</td>
                      <td>{c.number}</td>
                      <td>{c.hours}</td>
                      <td>
                        <GpaChip gpa={c.gpa} />
                      </td>
                      <td className="desc" title={c.description}>
                        {c.description}
                      </td>
                      <td>
                        <button className="btn ghost sm" onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                          <Search size={13} /> {expanded === c.id ? 'Hide' : 'View'} Sections
                        </button>
                      </td>
                      <td>
                        <AddButton id={c.id} />
                      </td>
                    </tr>
                    {expanded === c.id && (
                      <tr className="nested">
                        <td colSpan={8}>
                          <SectionTable course={c} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {!results.length && (
                  <tr>
                    <td colSpan={8} className="muted center">
                      No courses match. Try a broader keyword.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}

function AddButton({ id }) {
  const { plan } = usePlanner();
  const add = useAddCourse();
  const added = plan.courses.includes(id);
  return (
    <button className={`btn sm ${added ? 'ghost' : 'primary'}`} disabled={added} onClick={() => add(id)}>
      {added ? <Check size={13} /> : <Plus size={13} />} {added ? 'Added' : 'Add Course'}
    </button>
  );
}

function SectionTable({ course }) {
  const { plan, updatePlan } = usePlanner();

  const pin = (s) =>
    updatePlan((p) => ({
      courses: p.courses.includes(course.id) ? p.courses : [...p.courses, course.id],
      colors: p.colors[course.id] ? p.colors : { ...p.colors, [course.id]: nextColor(p) },
      pinned: p.pinned.includes(s.crn) ? p.pinned : [...p.pinned, s.crn],
      excluded: p.excluded.filter((c) => c !== s.crn),
      selectedKey: null,
    }));

  return (
    <table className="oscar-table inner">
      <thead>
        <tr>
          <th>Section</th>
          <th>CRN</th>
          <th>Type</th>
          <th>Instructor</th>
          <th>Prof GPA</th>
          <th>Meeting Times</th>
          <th>Location</th>
          <th>Status</th>
          <th>Linked</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {course.sections.map((s) => {
          const m = s.meetings[0];
          const lead = s.type === course.primaryType;
          const pinned = plan.pinned.includes(s.crn);
          return (
            <tr key={s.crn}>
              <td>{s.section}</td>
              <td className="mono">{s.crn}</td>
              <td>{s.type}</td>
              <td>{s.instructor}</td>
              <td>{lead ? <GpaChip gpa={course.instructors[s.instructor]} /> : '—'}</td>
              <td>
                {m && (
                  <div className="meet">
                    <DayBoxes days={m.days} />
                    <span>{fmtRange(m.start, m.end)}</span>
                  </div>
                )}
              </td>
              <td>{m?.location}</td>
              <td>
                <StatusCell s={s} />
              </td>
              <td>
                {(course.componentTypes.length > 0) && (
                  <span className="linked">
                    <Link2 size={13} /> {lead ? `needs ${course.componentTypes.join(' + ')}` : s.link ? `with ${s.link}` : 'any lecture'}
                  </span>
                )}
              </td>
              <td>
                <button className={`btn sm ${pinned ? 'ghost' : ''}`} disabled={pinned} onClick={() => pin(s)} title="Add course and force this section">
                  <Pin size={13} /> {pinned ? 'Pinned' : 'Pin'}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function DayBoxes({ days }) {
  return (
    <span className="dayboxes">
      {['S', 'M', 'T', 'W', 'R', 'F', 'S2'].map((d) => (
        <span key={d} className={days.includes(d) && d !== 'S2' && d !== 'S' ? 'on' : ''}>
          {d === 'R' ? 'T' : d === 'S2' ? 'S' : d}
        </span>
      ))}
    </span>
  );
}

export function StatusCell({ s }) {
  const st = seatStatus(s);
  if (st.kind === 'open')
    return (
      <span className="status open">
        <b>{s.seats.cap - s.seats.filled}</b> of {s.seats.cap} seats
      </span>
    );
  return (
    <span className="status full">
      <AlertCircle size={13} /> FULL
      {s.waitlist.cap > 0 && (
        <small>
          {' '}
          · WL {s.waitlist.cap - s.waitlist.filled}/{s.waitlist.cap}
        </small>
      )}
    </span>
  );
}
