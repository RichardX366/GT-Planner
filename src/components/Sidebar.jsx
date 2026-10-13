import { useState } from 'react';
import CourseAdd from './CourseAdd.jsx';
import CourseCard from './CourseCard.jsx';
import Criteria from './Criteria.jsx';
import { usePlanner } from '../lib/store.jsx';

export default function Sidebar({ result, selected }) {
  const { plan } = usePlanner();
  const [tab, setTab] = useState('courses');
  const activeCriteria = Object.values(plan.criteria).filter((c) => c.on).length;

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
            {plan.courses.map((id) => (
              <CourseCard
                key={id}
                id={id}
                selectedCrns={selected ? selected.sections.map((s) => s.crn) : []}
                empty={result.emptyCourses.includes(id)}
              />
            ))}
            <CourseAdd />
            <p className="disclaimer">
              Tip: <b>pin</b> a section to force it, <b>ban</b> a section or professor to exclude it, or{' '}
              <b>star</b> a professor to only consider their sections. Set time, day, seat and GPA rules in{' '}
              <a onClick={() => setTab('criteria')}>Auto-Schedule</a>.
            </p>
          </>
        ) : (
          <Criteria result={result} />
        )}
      </div>
      <div className="side-foot">Sample Fall 2026 data · not live OSCAR data</div>
    </aside>
  );
}
