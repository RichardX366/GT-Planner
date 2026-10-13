import { Fragment, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, ChevronLeft, ChevronRight, Link2, Pin, Plus, Search } from 'lucide-react';
import { GpaChip } from './CourseCard.jsx';
import Combobox from './Combobox.jsx';
import { cachedSubjects, fetchSubjects } from '../lib/details.js';
import { useAddCourse } from './CourseAdd.jsx';
import { nextColor, usePlanner } from '../lib/store.jsx';
import { useData } from '../lib/data.jsx';
import { termLabel } from '../lib/api.js';
import { isLead, seatStatus } from '../lib/scheduler.js';
import { fmtRange } from '../lib/time.js';

const PAGE_SIZE = 25;
const empty = { subject: '', number: '', keyword: '' };

export default function FindClasses() {
  const { term, catalog, getGpa, requestGpa } = useData();
  const [form, setForm] = useState(empty);
  const [query, setQuery] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [page, setPage] = useState(0);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Subject names come from Banner (cached per term); codes come from the catalog.
  const [subjectNames, setSubjectNames] = useState(() => cachedSubjects(term) || {});
  useEffect(() => {
    let cancelled = false;
    fetchSubjects(term)
      .then((names) => !cancelled && setSubjectNames(names))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [term]);

  const subjectOptions = useMemo(() => {
    const counts = {};
    for (const c of Object.values(catalog.courses)) counts[c.subject] = (counts[c.subject] || 0) + 1;
    return Object.keys(counts)
      .sort()
      .map((code) => ({ value: code, label: subjectNames[code] || '', hint: `${counts[code]}` }));
  }, [catalog, subjectNames]);

  const results = useMemo(() => {
    if (!query) return [];
    const kw = query.keyword.trim().toLowerCase();
    return Object.values(catalog.courses)
      .filter(
        (c) =>
          (!query.subject || c.subject === query.subject) &&
          (!query.number || c.number.startsWith(query.number.trim().toUpperCase())) &&
          (!kw || c.title.toLowerCase().includes(kw) || c.description.toLowerCase().includes(kw))
      )
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  }, [query, catalog]);

  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const visible = results.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Only ask Course Critique for the courses actually on screen.
  useEffect(() => {
    requestGpa(visible.map((c) => c.id));
  }, [visible.map((c) => c.id).join()]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (e) => {
    e.preventDefault();
    setQuery(form);
    setExpanded(null);
    setPage(0);
  };

  return (
    <main className="page">
      <form className="search-card" onSubmit={submit}>
        <h1>Find Classes</h1>
        <p className="muted">Term: {termLabel(term)}</p>
        <div className="search-grid">
          <label>
            Subject
            <Combobox
              value={form.subject}
              onChange={(subject) => setForm((f) => ({ ...f, subject }))}
              options={subjectOptions}
              placeholder="Any subject — type a code or name"
            />
          </label>
          <label>
            Course Number
            <input value={form.number} onChange={set('number')} placeholder="e.g. 1332" />
          </label>
          <label className="wide">
            Keyword
            <input value={form.keyword} onChange={set('keyword')} placeholder="Title or description, e.g. algorithms" />
          </label>
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
        </div>
      </form>

      {query && (
        <div className="results">
          <div className="results-head">
            <b>Search Results — {results.length} Courses</b>
            <span className="muted">
              Term: {termLabel(term)}
              {query.subject && ` · Subject: ${subjectNames[query.subject] || query.subject}`}
              {query.number && ` · Course Number: ${query.number}`}
            </span>
          </div>
          <div className="oscar-table-wrap">
            <table className="oscar-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Course</th>
                  <th>Hours</th>
                  <th>Avg GPA</th>
                  <th>Description</th>
                  <th>Sections</th>
                  <th>Add Course</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => (
                  <Fragment key={c.id}>
                    <tr>
                      <td>
                        <a onClick={() => setExpanded(expanded === c.id ? null : c.id)}>{c.title}</a>
                      </td>
                      <td className="nowrap">{c.id}</td>
                      <td>{c.hours}</td>
                      <td>
                        <GpaChip gpa={getGpa(c.id)?.course} />
                      </td>
                      <td className="desc" title={c.description}>
                        {c.description}
                      </td>
                      <td>
                        <button className="btn ghost sm" onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                          <Search size={13} /> {expanded === c.id ? 'Hide' : 'View'} Sections ({c.sections.length})
                        </button>
                      </td>
                      <td>
                        <AddButton id={c.id} />
                      </td>
                    </tr>
                    {expanded === c.id && (
                      <tr className="nested">
                        <td colSpan={7}>
                          <SectionTable course={c} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {!results.length && (
                  <tr>
                    <td colSpan={7} className="muted center">
                      No courses match. Try a broader keyword.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {pages > 1 && (
              <div className="oscar-foot">
                <div className="pager">
                  <button className="icon-btn sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft size={15} />
                  </button>
                  <span>
                    Page {page + 1} of {pages}
                  </span>
                  <button className="icon-btn sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight size={15} />
                  </button>
                </div>
                <span className="muted">Records: {results.length}</span>
              </div>
            )}
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
  const { seats, requestSeats, requestGpa, instructorGpa } = useData();

  useEffect(() => {
    requestSeats(course.sections.map((s) => s.crn));
    requestGpa([course.id]);
  }, [course, requestSeats, requestGpa]);

  const pin = (s) =>
    updatePlan((p) => ({
      courses: p.courses.includes(course.id) ? p.courses : [...p.courses, course.id],
      colors: p.colors[course.id] ? p.colors : { ...p.colors, [course.id]: nextColor(p) },
      pinned: p.pinned.includes(s.crn) ? p.pinned : [...p.pinned, s.crn],
      excluded: p.excluded.filter((c) => c !== s.crn),
      selectedKey: null,
    }));

  const lectureOf = (lab) => course.leads.filter((l) => l.labCrns.includes(lab.crn)).map((l) => l.section);

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
          <th>Campus</th>
          <th>Status</th>
          <th>Linked</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {course.sections.map((s) => {
          const lead = isLead(course, s);
          const pinned = plan.pinned.includes(s.crn);
          return (
            <tr key={s.crn}>
              <td>{s.section}</td>
              <td className="mono">{s.crn}</td>
              <td>{s.type}</td>
              <td>{s.instructors.join(', ') || 'TBA'}</td>
              <td>{lead ? <GpaChip gpa={instructorGpa(course.id, s.instructor)} /> : '—'}</td>
              <td>
                <Meetings s={s} />
              </td>
              <td>{s.meetings.map((m) => m.location).filter(Boolean).join(', ') || 'TBA'}</td>
              <td className="nowrap">{s.campus}</td>
              <td>
                <StatusCell seat={seats[s.crn]} />
              </td>
              <td>
                {course.hasLab && (lead ? s.labCrns.length > 0 : true) && (
                  <span className="linked">
                    <Link2 size={13} />{' '}
                    {lead ? `${s.labCrns.length} linked lab${s.labCrns.length === 1 ? '' : 's'}` : `with ${lectureOf(s).join(', ') || 'any'}`}
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

export function Meetings({ s }) {
  if (!s.meetings.length) return <span className="muted">TBA</span>;
  return (
    <div className="meet-list">
      {s.meetings.map((m, i) => (
        <div key={i} className="meet">
          <DayBoxes days={m.days} />
          <span>{fmtRange(m.start, m.end)}</span>
        </div>
      ))}
    </div>
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

export function StatusCell({ seat }) {
  const st = seatStatus(seat);
  if (st.kind === 'unknown') return <span className="muted">{st.label}</span>;
  if (st.kind === 'open')
    return (
      <span className="status open">
        <b>{seat.cap - seat.filled}</b> of {seat.cap} seats
      </span>
    );
  return (
    <span className="status full">
      <AlertCircle size={13} /> FULL
      {seat.wlCap > 0 && (
        <small>
          {' '}
          · WL {seat.wlCap - seat.wlFilled}/{seat.wlCap}
        </small>
      )}
    </span>
  );
}
