import { useState } from 'react';
import { AlertTriangle, Ban, ChevronDown, ChevronRight, ChevronUp, Info, Palette, Star, Trash2 } from 'lucide-react';
import CourseInfo, { SectionInfo } from './CourseInfo.jsx';
import { usePreview } from '../lib/preview.jsx';
import { useSeatFilter } from './SeatKey.jsx';
import { PALETTE, toggleIn, usePlanner } from '../lib/store.jsx';
import { useData } from '../lib/data.jsx';
import { courseBundles, seatStatus } from '../lib/scheduler.js';
import { fmtRange } from '../lib/time.js';

export default function CourseCard({ id, selectedCrns, empty, conflicts = {} }) {
  const { plan, updatePlan } = usePlanner();
  const { catalog, getGpa, instructorGpa, instructorId, seats } = useData();
  const { filter: seatFilter } = useSeatFilter();
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState(false);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const toggleCollapsed = (key) =>
    setCollapsed((c) => {
      const next = new Set(c);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  const course = catalog.courses[id];
  const color = plan.colors[id];

  const remove = () =>
    updatePlan((p) => {
      const crns = new Set(course ? course.sections.map((s) => s.crn) : []);
      return {
        courses: p.courses.filter((c) => c !== id),
        pinned: p.pinned.filter((c) => !crns.has(c)),
        excluded: p.excluded.filter((c) => !crns.has(c)),
        selectedKey: null,
      };
    });

  if (!course)
    return (
      <div className="course-card" style={{ '--c': '#cfd8dc' }}>
        <div className="course-head">
          <div className="course-top">
            <span className="course-id">{id}</span>
            <button className="icon-btn sm" title="Remove course" onClick={remove}>
              <Trash2 size={14} />
            </button>
          </div>
          <div className="course-title">Not offered this term</div>
        </div>
      </div>
    );

  const banned = plan.bannedInstructors[id] || [];
  const forced = plan.forcedInstructors[id] || [];
  const options = courseBundles(course, plan).length;
  const campus = plan.criteria.campus;
  const onCampus = (s) => !campus.on || s.campus === campus.value;
  const hiddenCount = course.sections.filter((s) => !onCampus(s)).length;
  const courseGpa = getGpa(id);

  // Seat filter only affects what's listed; pinned sections and ones in the shown schedule always stay.
  const visible = (s) =>
    (seatFilter[seatStatus(seats[s.crn]).kind] && (seatFilter.conflict || !conflicts[s.crn])) ||
    plan.pinned.includes(s.crn) ||
    selectedCrns.includes(s.crn);
  const filteredOut = course.sections.filter((s) => onCampus(s) && !visible(s)).length;
  const row = (s) => (
    <SectionRow key={s.crn} s={s} active={selectedCrns.includes(s.crn)} conflict={conflicts[s.crn]} />
  );

  const byInstructor = {};
  course.leads.filter(onCampus).forEach((s) => (byInstructor[s.instructor] ||= []).push(s));
  const visibleLabs = course.labs.filter((s) => onCampus(s) && visible(s));

  const setInstr = (field, name) =>
    updatePlan((p) => {
      const other = field === 'bannedInstructors' ? 'forcedInstructors' : 'bannedInstructors';
      return {
        [field]: { ...p[field], [id]: toggleIn(p[field][id] || [], name) },
        [other]: { ...p[other], [id]: (p[other][id] || []).filter((n) => n !== name) },
        selectedKey: null,
      };
    });

  const cycleColor = () =>
    updatePlan((p) => ({ colors: { ...p.colors, [id]: PALETTE[(PALETTE.indexOf(color) + 1) % PALETTE.length] } }));

  const labTypes = [...new Set(course.labs.map((l) => l.type))].join(' / ');

  return (
    <div className="course-card" style={{ '--c': color }}>
      <div className="course-head" onClick={() => setOpen((o) => !o)}>
        <div className="course-top">
          <span className="course-id">{id}</span>
          <div className="course-actions" onClick={(e) => e.stopPropagation()}>
            <button className="icon-btn sm" title={open ? 'Collapse' : 'Show sections'} onClick={() => setOpen((o) => !o)}>
              {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            <button className="icon-btn sm" title="Course details" onClick={() => setInfo(true)}>
              <Info size={14} />
            </button>
            <button className="icon-btn sm" title="Change color" onClick={cycleColor}>
              <Palette size={14} />
            </button>
            <button className="icon-btn sm" title="Remove course" onClick={remove}>
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        <div className="course-title">{course.title}</div>
        <div className="course-meta">
          <span>
            Course GPA: {courseGpa === undefined ? '…' : courseGpa.course != null ? courseGpa.course.toFixed(2) : 'N/A'}
          </span>
          <span>{course.hours} cr</span>
          {empty ? (
            <span className="danger-text">
              <AlertTriangle size={12} /> No sections left
            </span>
          ) : (
            <span>
              {options} option{options === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>

      {open && (
        <div className="course-body">
          {Object.entries(byInstructor).map(([name, secs]) => {
            const shown = secs.filter(visible);
            if (!shown.length && !banned.includes(name) && !forced.includes(name)) return null;
            const isBanned = banned.includes(name);
            const isForced = forced.includes(name);
            return (
              <div key={name} className={`instr ${isBanned ? 'banned' : ''} ${forced.length && !isForced ? 'dim' : ''}`}>
                <div className="instr-head">
                  <GroupToggle open={!collapsed.has(name)} count={shown.length} onToggle={() => toggleCollapsed(name)}>
                    <div className="instr-name">{name}</div>
                  </GroupToggle>
                  <div className="row-actions">
                    <a
                      className="icon-btn sm rmp"
                      href={`https://www.ratemyprofessors.com/search/professors/361?q=${encodeURIComponent(name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Search ${name} on Rate My Professors`}
                    >
                      RMP
                    </a>
                    <button
                      className={`icon-btn sm ${isForced ? 'on-gold' : ''}`}
                      title={isForced ? 'Unstar professor' : 'Only use this professor (force)'}
                      onClick={() => setInstr('forcedInstructors', name)}
                    >
                      <Star size={14} fill={isForced ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      className={`icon-btn sm ${isBanned ? 'on-red' : ''}`}
                      title={isBanned ? 'Unban professor' : 'Ban professor'}
                      onClick={() => setInstr('bannedInstructors', name)}
                    >
                      <Ban size={14} />
                    </button>
                  </div>
                  <div className="instr-gpa">
                    Instructor GPA:{' '}
                    <GpaChip
                      gpa={courseGpa === undefined ? undefined : instructorGpa(id, name)}
                      href={
                        instructorId(id, name) &&
                        `https://critique.gatech.edu/prof?profID=${encodeURIComponent(instructorId(id, name))}`
                      }
                    />
                  </div>
                </div>
                {!isBanned && !collapsed.has(name) && shown.map(row)}
              </div>
            );
          })}
          {course.hasLab && visibleLabs.length > 0 && (
            <div className="instr">
              <div className="instr-head">
                <GroupToggle open={!collapsed.has('__labs')} count={visibleLabs.length} onToggle={() => toggleCollapsed('__labs')}>
                  <div className="instr-name">{labTypes} sections</div>
                </GroupToggle>
                <div className="instr-gpa">Linked — one is required with the lecture</div>
              </div>
              {!collapsed.has('__labs') && visibleLabs.map(row)}
            </div>
          )}
          {filteredOut > 0 && (
            <div className="hidden-note">
              {filteredOut} section{filteredOut === 1 ? '' : 's'} hidden by filter
            </div>
          )}
          {hiddenCount > 0 && (
            <div className="hidden-note">
              {hiddenCount} section{hiddenCount === 1 ? '' : 's'} at other campuses hidden
            </div>
          )}
        </div>
      )}
      {info && <CourseInfo courseId={id} onClose={() => setInfo(false)} />}
    </div>
  );
}

/** conflict: undefined (fits), or a list of course ids it clashes with ([] = clashes with a combination). */
function SectionRow({ s, active, conflict }) {
  const { plan, updatePlan } = usePlanner();
  const { setPreviewCrn } = usePreview();
  const [info, setInfo] = useState(false);
  const { seats } = useData();
  const pinned = plan.pinned.includes(s.crn);
  const excluded = plan.excluded.includes(s.crn);
  const st = seatStatus(seats[s.crn]);

  const togglePin = () =>
    updatePlan((p) => ({ pinned: toggleIn(p.pinned, s.crn), excluded: p.excluded.filter((c) => c !== s.crn), selectedKey: null }));

  // Clicking the row pins (forces) the section; clicking again unpins it.
  return (
    <div
      className={`section-row ${active ? 'active' : ''} ${pinned ? 'pinned' : ''} ${excluded ? 'excluded' : ''} ${conflict ? 'conflict' : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={pinned}
      title={[
        conflict &&
          `Time conflict with ${conflict.length ? conflict.join(', ') : 'your other courses'} — no schedule can include this section`,
        pinned ? 'Pinned — click to unpin' : conflict ? 'Click to pin anyway' : 'Click to pin this section',
      ]
        .filter(Boolean)
        .join('\n')}
      onClick={togglePin}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), togglePin())}
      onMouseEnter={() => !info && setPreviewCrn(s.crn)}
      onMouseLeave={() => setPreviewCrn(null)}
    >
      <div className="sec-main">
        <span className="sec-id">{s.section}</span>
        <span className="sec-crn">{s.crn}</span>
      </div>
      <div className="sec-time">
        {s.meetings.length ? s.meetings.map((m) => `${m.days} ${fmtRange(m.start, m.end)}`).join(' · ') : 'TBA'}
      </div>
      <div className="row-actions">
        <button
          className="icon-btn sm"
          title="Section details"
          onClick={(e) => {
            e.stopPropagation();
            setPreviewCrn(null);
            setInfo(true);
          }}
        >
          <Info size={13} />
        </button>
        <span className="seat-slot" title={st.label} aria-label={st.label}>
          <span className={`seat-dot ${st.kind}`} />
        </span>
        <button
          className={`icon-btn sm ${excluded ? 'on-red' : ''}`}
          title={excluded ? 'Allow section' : 'Ban this section'}
          onClick={(e) => {
            e.stopPropagation();
            updatePlan((p) => ({ excluded: toggleIn(p.excluded, s.crn), pinned: p.pinned.filter((c) => c !== s.crn), selectedKey: null }));
          }}
        >
          <Ban size={13} />
        </button>
      </div>
      {info && <SectionInfo section={s} onClose={() => setInfo(false)} />}
    </div>
  );
}

/** Collapsible header for a professor (or lab) group. */
function GroupToggle({ open, count, onToggle, children }) {
  return (
    <button className="group-toggle" aria-expanded={open} onClick={onToggle} title={open ? 'Collapse' : 'Expand'}>
      {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      {children}
      {!open && <span className="group-count">{count}</span>}
    </button>
  );
}

/** gpa: number, null (no data), or undefined (still loading). href makes it a link (opens a new tab). */
export function GpaChip({ gpa, href }) {
  if (gpa === undefined) return <span className="gpa na">…</span>;
  if (gpa == null) return <span className="gpa na">N/A</span>;
  const tier = gpa >= 3.3 ? 'hi' : gpa >= 2.9 ? 'mid' : 'lo';
  if (href)
    return (
      <a
        className={`gpa ${tier} gpa-link`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title="Open on Course Critique"
        onClick={(e) => e.stopPropagation()}
      >
        {gpa.toFixed(2)}
      </a>
    );
  return <span className={`gpa ${tier}`}>{gpa.toFixed(2)}</span>;
}
