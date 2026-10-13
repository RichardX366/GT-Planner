import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import { useData } from '../lib/data.jsx';
import { usePlanner } from '../lib/store.jsx';
import {
  cachedDetail,
  cachedSectionDetail,
  DETAIL_TABS,
  fetchDetail,
  fetchSectionDetail,
  SECTION_TABS,
} from '../lib/details.js';

/** Details are stored in localStorage only for courses in one of the user's plans. */
function useInPlan(courseId) {
  const { state } = usePlanner();
  const { term } = useData();
  return Object.values(state.plans).some((p) => p.term === term && p.courses.includes(courseId));
}

/** OSCAR-style "Course Details" dialog. */
export default function CourseInfo({ courseId, onClose }) {
  const { term, catalog } = useData();
  const persist = useInPlan(courseId);
  const course = catalog.courses[courseId];
  return (
    <DetailsModal
      title={`Course Details for ${courseId}${course ? `, ${course.title}` : ''}`}
      sub={`Term: ${term}`}
      tabs={DETAIL_TABS}
      cached={(ep) => cachedDetail(term, courseId, ep)}
      load={(ep) => fetchDetail(term, courseId, ep, persist)}
      onClose={onClose}
    />
  );
}

/** OSCAR-style "Class Details" dialog for one section (section-specific tabs only). */
export function SectionInfo({ section, onClose }) {
  const { term, catalog } = useData();
  const persist = useInPlan(section.courseId);
  const course = catalog.courses[section.courseId];
  return (
    <DetailsModal
      title={`Class Details for ${section.courseId} ${section.section}${course ? `, ${course.title}` : ''}`}
      sub={`Term: ${term} | CRN: ${section.crn}`}
      tabs={SECTION_TABS}
      cached={(ep) => cachedSectionDetail(term, section.crn, ep)}
      load={(ep) => fetchSectionDetail(term, section, ep, persist)}
      render={(ep, value) => (ep === 'getFacultyMeetingTimes' ? <MeetingTimes data={value} /> : null)}
      onClose={onClose}
    />
  );
}

function DetailsModal({ title, sub, tabs, cached, load, render, onClose }) {
  const [tab, setTab] = useState(tabs[0][0]);
  const [content, setContent] = useState({});
  const [errors, setErrors] = useState({});

  // Load the open tab on demand (Banner rate-limits bursts of requests).
  const value = content[tab] !== undefined ? content[tab] : cached(tab);
  useEffect(() => {
    if (value !== undefined || errors[tab]) return;
    let cancelled = false;
    load(tab)
      .then((v) => !cancelled && setContent((c) => ({ ...c, [tab]: v })))
      .catch((e) => !cancelled && setErrors((x) => ({ ...x, [tab]: e.message })));
    return () => {
      cancelled = true;
    };
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const custom = value !== undefined && render ? render(tab, value) : null;

  return createPortal(
    // React events bubble out of portals to the opener (e.g. a clickable section row), so stop them here.
    <div
      className="modal-backdrop"
      onMouseDown={onClose}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" title="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-sub muted">{sub}</div>
        <div className="modal-body">
          <nav className="detail-tabs">
            {tabs.map(([ep, label]) => (
              <button key={ep} className={tab === ep ? 'active' : ''} onClick={() => setTab(ep)}>
                {label}
              </button>
            ))}
          </nav>
          <div className="detail-content">
            {custom ? (
              custom
            ) : value !== undefined ? (
              // Banner's HTML is passed through a tag/attribute whitelist in details.js.
              <div className="banner-html" dangerouslySetInnerHTML={{ __html: value || '<p>No information available.</p>' }} />
            ) : errors[tab] ? (
              <p className="danger-text">Couldn’t load this from Banner ({errors[tab]}).</p>
            ) : (
              <p className="muted loading-inline">
                <Loader2 size={15} className="spin" /> Loading…
              </p>
            )}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

const fmtBanner = (t) => {
  if (!t) return 'TBA';
  const h = +t.slice(0, 2);
  const m = t.slice(2);
  return `${((h + 11) % 12) + 1}:${m} ${h < 12 ? 'am' : 'pm'}`;
};

function MeetingTimes({ data }) {
  return (
    <div className="banner-html">
      <h3>Instructors</h3>
      {data.faculty.length ? (
        <ul className="plain-list">
          {data.faculty.map((f) => (
            <li key={f.name}>
              {f.name.split(', ').reverse().join(' ')}
              {f.primary && <span className="tiny-badge">Primary</span>}
              {f.email && (
                <>
                  {' · '}
                  <a href={`mailto:${f.email}`}>{f.email}</a>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No instructor assigned.</p>
      )}
      <h3>Meeting Times</h3>
      {data.meetings.length ? (
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Days</th>
              <th>Time</th>
              <th>Where</th>
              <th>Dates</th>
            </tr>
          </thead>
          <tbody>
            {data.meetings.map((m, i) => (
              <tr key={i}>
                <td>{m.type}</td>
                <td>{m.days || 'TBA'}</td>
                <td>{m.begin ? `${fmtBanner(m.begin)} – ${fmtBanner(m.end)}` : 'TBA'}</td>
                <td>{m.where || 'TBA'}</td>
                <td>{m.dates}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">No meeting times listed.</p>
      )}
    </div>
  );
}
