import { useState } from 'react';
import { AlertTriangle, Ban, ChevronDown, ChevronUp, Palette, Pin, Star, Trash2 } from 'lucide-react';
import { COURSES } from '../data/catalog.js';
import { PALETTE, toggleIn, usePlanner } from '../lib/store.jsx';
import { optionCount, seatStatus } from '../lib/scheduler.js';
import { fmtRange } from '../lib/time.js';

export default function CourseCard({ id, selectedCrns, empty }) {
  const { plan, updatePlan } = usePlanner();
  const [open, setOpen] = useState(false);
  const course = COURSES[id];
  if (!course) return null;
  const color = plan.colors[id];
  const banned = plan.bannedInstructors[id] || [];
  const forced = plan.forcedInstructors[id] || [];
  const options = optionCount(course, plan);

  const leads = course.sections.filter((s) => s.type === course.primaryType);
  const byInstructor = {};
  leads.forEach((s) => (byInstructor[s.instructor] ||= []).push(s));

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

  const remove = () =>
    updatePlan((p) => {
      const crns = new Set(course.sections.map((s) => s.crn));
      return {
        courses: p.courses.filter((c) => c !== id),
        pinned: p.pinned.filter((c) => !crns.has(c)),
        excluded: p.excluded.filter((c) => !crns.has(c)),
        selectedKey: null,
      };
    });

  return (
    <div className="course-card" style={{ '--c': color }}>
      <div className="course-head" onClick={() => setOpen((o) => !o)}>
        <div className="course-top">
          <span className="course-id">{id}</span>
          <div className="course-actions" onClick={(e) => e.stopPropagation()}>
            <button className="icon-btn sm" title={open ? 'Collapse' : 'Show sections'} onClick={() => setOpen((o) => !o)}>
              {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
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
          <span>Course GPA: {course.gpa?.toFixed(2) ?? 'N/A'}</span>
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
            const isBanned = banned.includes(name);
            const isForced = forced.includes(name);
            const g = course.instructors[name];
            return (
              <div key={name} className={`instr ${isBanned ? 'banned' : ''} ${forced.length && !isForced ? 'dim' : ''}`}>
                <div className="instr-head">
                  <div>
                    <div className="instr-name">{name}</div>
                    <div className="instr-gpa">
                      Instructor GPA: <GpaChip gpa={g} />
                    </div>
                  </div>
                  <div className="row-actions">
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
                </div>
                {!isBanned && secs.map((s) => <SectionRow key={s.crn} s={s} active={selectedCrns.includes(s.crn)} />)}
              </div>
            );
          })}
          {course.componentTypes.map((type) => (
            <div key={type} className="instr">
              <div className="instr-head">
                <div>
                  <div className="instr-name">{type} sections</div>
                  <div className="instr-gpa">Linked — one is required with the lecture</div>
                </div>
              </div>
              {course.sections
                .filter((s) => s.type === type)
                .map((s) => (
                  <SectionRow key={s.crn} s={s} active={selectedCrns.includes(s.crn)} />
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionRow({ s, active }) {
  const { plan, updatePlan } = usePlanner();
  const pinned = plan.pinned.includes(s.crn);
  const excluded = plan.excluded.includes(s.crn);
  const st = seatStatus(s);
  const m = s.meetings[0];

  return (
    <div className={`section-row ${active ? 'active' : ''} ${excluded ? 'excluded' : ''}`}>
      <div className="sec-main">
        <span className="sec-id">{s.section}</span>
        <span className={`seat-dot ${st.kind}`} title={st.label} />
        <span className="sec-crn">{s.crn}</span>
      </div>
      <div className="sec-time">{m ? `${m.days} ${fmtRange(m.start, m.end)}` : 'TBA'}</div>
      <div className="row-actions">
        <button
          className={`icon-btn sm ${pinned ? 'on-gold' : ''}`}
          title={pinned ? 'Unpin section' : 'Pin (force) this section'}
          onClick={() =>
            updatePlan((p) => ({ pinned: toggleIn(p.pinned, s.crn), excluded: p.excluded.filter((c) => c !== s.crn), selectedKey: null }))
          }
        >
          <Pin size={13} fill={pinned ? 'currentColor' : 'none'} />
        </button>
        <button
          className={`icon-btn sm ${excluded ? 'on-red' : ''}`}
          title={excluded ? 'Allow section' : 'Ban this section'}
          onClick={() =>
            updatePlan((p) => ({ excluded: toggleIn(p.excluded, s.crn), pinned: p.pinned.filter((c) => c !== s.crn), selectedKey: null }))
          }
        >
          <Ban size={13} />
        </button>
      </div>
    </div>
  );
}

export function GpaChip({ gpa }) {
  if (gpa == null) return <span className="gpa na">N/A</span>;
  const tier = gpa >= 3.3 ? 'hi' : gpa >= 2.9 ? 'mid' : 'lo';
  return <span className={`gpa ${tier}`}>{gpa.toFixed(2)}</span>;
}
