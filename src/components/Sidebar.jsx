import { useState } from 'react';
import CourseAdd from './CourseAdd.jsx';
import CourseCard from './CourseCard.jsx';
import Criteria from './Criteria.jsx';
import { SeatFilter, SeatLegend } from './SeatKey.jsx';
import { usePlanner } from '../lib/store.jsx';
import { useData } from '../lib/data.jsx';

export default function Sidebar({ result, selected }) {
  const { plan } = usePlanner();
  const { catalog } = useData();
  const [tab, setTab] = useState('courses');
  const activeCriteria = Object.entries(plan.criteria).filter(([k, c]) => k !== 'campus' && c.on).length;

  return (
    <aside className="sidebar">
      <div className="side-tabs">
        <button className={tab === 'courses' ? 'active' : ''} onClick={() => setTab('courses')}>
          Courses
        </button>
        <button className={tab === 'criteria' ? 'active' : ''} onClick={() => setTab('criteria')}>
          Auto-Schedule {activeCriteria > 0 && <span className="count">{activeCriteria}</span>}
        </button>
      </div>
      <div className="side-scroll">
        {tab === 'courses' ? (
          <>
            <SeatFilter />
            {plan.courses.map((id) => (
              <CourseCard
                key={id}
                id={id}
                selectedCrns={selected ? selected.sections.map((s) => s.crn) : []}
                empty={result.emptyCourses.includes(id)}
                conflicts={result.conflicts}
              />
            ))}
            <CourseAdd />
            <p className="disclaimer">
              Tip: <b>pin</b> a section to force it, <b>ban</b> a section or professor to exclude it, or{' '}
              <b>star</b> a professor to only consider their sections. Set time, day, seat and GPA rules in{' '}
              <a onClick={() => setTab('criteria')}>Auto-Schedule</a>.
            </p>
            <SeatLegend />
          </>
        ) : (
          <Criteria />
        )}
      </div>
      <div className="side-foot">
        Course data fetched {catalog.updatedAt ? timeAgo(catalog.updatedAt) : '—'} · GPAs from Course Critique
      </div>
    </aside>
  );
}

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  return `${Math.round(hrs / 24)} days ago`;
}
