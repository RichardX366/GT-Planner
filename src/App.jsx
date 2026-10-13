import { useEffect, useMemo, useState } from 'react';
import Header from './components/Header.jsx';
import Sidebar from './components/Sidebar.jsx';
import Calendar from './components/Calendar.jsx';
import Combinations from './components/Combinations.jsx';
import FindClasses from './components/FindClasses.jsx';
import PlanView from './components/PlanView.jsx';
import PlanBar from './components/PlanBar.jsx';
import { usePlanner } from './lib/store.jsx';
import { generateSchedules } from './lib/scheduler.js';

export default function App() {
  const { plan, updatePlan } = usePlanner();
  const [tab, setTab] = useState('scheduler');
  const [hoverKey, setHoverKey] = useState(null);

  const result = useMemo(() => generateSchedules(plan.courses, plan), [plan]);
  const all = useMemo(() => [...result.matches, ...result.backups], [result]);
  const selected = all.find((c) => c.key === plan.selectedKey) || all[0] || null;
  const shown = (hoverKey && all.find((c) => c.key === hoverKey)) || selected;

  // Arrow keys cycle through combinations, like flipping through candidate schedules.
  useEffect(() => {
    if (tab !== 'scheduler') return;
    const onKey = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      if (!all.length) return;
      e.preventDefault();
      const i = selected ? all.indexOf(selected) : -1;
      const next = all[(i + (e.key === 'ArrowDown' ? 1 : all.length - 1)) % all.length];
      updatePlan(() => ({ selectedKey: next.key }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab, all, selected, updatePlan]);

  return (
    <div className="app">
      <Header tab={tab} setTab={setTab} selected={selected} />
      {tab === 'scheduler' && (
        <main className="scheduler">
          <Sidebar result={result} selected={selected} />
          <section className="calendar-pane">
            {shown && shown.violations.length > 0 && (
              <div className="notice warn backup-banner">
                <strong>Backup schedule</strong>
                <span>Breaks: {shown.violations.map((v) => v.text).join(' · ')}</span>
              </div>
            )}
            <Calendar combo={shown} colors={plan.colors} criteria={plan.criteria} preview={shown !== selected} />
          </section>
          <Combinations result={result} selected={selected} setHoverKey={setHoverKey} />
        </main>
      )}
      {tab === 'find' && <FindClasses />}
      {tab === 'plan' && <PlanView selected={selected} goScheduler={() => setTab('scheduler')} />}
      <PlanBar selected={selected} openPlan={() => setTab('plan')} />
    </div>
  );
}
