import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Header from './components/Header.jsx';
import Sidebar from './components/Sidebar.jsx';
import Calendar from './components/Calendar.jsx';
import Combinations from './components/Combinations.jsx';
import FindClasses from './components/FindClasses.jsx';
import PlanView from './components/PlanView.jsx';
import PlanBar from './components/PlanBar.jsx';
import { usePlanner } from './lib/store.jsx';
import { useData } from './lib/data.jsx';
import { useSchedules } from './lib/useSchedules.js';
import { termLabel } from './lib/api.js';
import { pruneDetailCache } from './lib/details.js';
import { PreviewContext } from './lib/preview.jsx';

export default function App() {
  const { state, plan, updatePlan } = usePlanner();
  const { term, catalog, requestGpa, requestSeats } = useData();
  const [tab, setTab] = useState('scheduler');
  const [hoverKey, setHoverKey] = useState(null);
  const [previewCrn, setPreviewCrn] = useState(null);
  const previewCtx = useMemo(() => ({ previewCrn, setPreviewCrn }), [previewCrn]);
  const ready = catalog.status === 'ready' && plan;

  // Course details are only kept for courses that are in one of the user's plans.
  useEffect(() => {
    pruneDetailCache(new Set(Object.values(state.plans).flatMap((p) => p.courses.map((c) => `${p.term}|${c}`))));
  }, [state.plans]);

  // Load GPAs and live seat counts for every course in the plan.
  useEffect(() => {
    if (!ready) return;
    const ids = plan.courses.filter((id) => catalog.courses[id]);
    requestGpa(ids);
    const campus = plan.criteria.campus;
    requestSeats(
      ids.flatMap((id) =>
        catalog.courses[id].sections.filter((s) => !campus.on || s.campus === campus.value).map((s) => s.crn)
      )
    );
  }, [ready, plan?.courses, plan?.criteria.campus, catalog, requestGpa, requestSeats]); // eslint-disable-line react-hooks/exhaustive-deps

  const { result, hasResult, pending } = useSchedules(plan, ready);
  const all = useMemo(() => [...result.matches, ...result.backups], [result]);
  // Fall back to an equivalent schedule (same profs and times) if the exact CRNs changed.
  const selected =
    all.find((c) => c.key === plan?.selectedKey) || all.find((c) => c.sig === plan?.selectedSig) || all[0] || null;
  const select = useCallback((c) => updatePlan(() => ({ selectedKey: c.key, selectedSig: c.sig })), [updatePlan]);
  const shown = (hoverKey && all.find((c) => c.key === hoverKey)) || selected;

  // Autosave: the plan always remembers the schedule you're looking at (its CRNs), so the
  // Registration Plan tab and other plans' summaries reflect it without a Save button.
  useEffect(() => {
    if (!ready || pending) return;
    const crns = selected ? selected.sections.map((s) => s.crn) : [];
    const savedKey = plan.saved ? [...plan.saved.crns].sort().join('-') : '';
    if (savedKey === [...crns].sort().join('-')) return;
    updatePlan(() => ({ saved: crns.length ? { crns, at: new Date().toISOString() } : null }));
  }, [ready, pending, selected?.key, plan?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
      select(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab, all, selected, select]);

  return (
    <PreviewContext.Provider value={previewCtx}>
      <div className="app">
        <Header tab={tab} setTab={setTab} selected={selected} />
        {!ready ? (
          catalog.status === 'restoring' ? (
            <div />
          ) : (
          <div className="loading">
            {catalog.status === 'error' ? (
              <>
                <b>Couldn’t load course data.</b>
                <span className="muted">{catalog.error}</span>
                <button className="btn" onClick={() => location.reload()}>
                  Retry
                </button>
              </>
            ) : (
              <>
                <Loader2 className="spin" size={22} />
                <span>Loading {term ? termLabel(term) : ''} courses from GT Scheduler’s crawler…</span>
              </>
            )}
          </div>
          )
        ) : (
          <>
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
                  <Calendar
                    combo={shown}
                    colors={plan.colors}
                    criteria={plan.criteria}
                    preview={shown !== selected}
                    ghost={catalog.byCrn[previewCrn] || null}
                  />
                </section>
                <Combinations
                  result={result}
                  hasResult={hasResult}
                  pending={pending}
                  selected={selected}
                  select={select}
                  setHoverKey={setHoverKey}
                />
              </main>
            )}
            {tab === 'find' && <FindClasses />}
            {tab === 'plan' && <PlanView selected={selected} goScheduler={() => setTab('scheduler')} />}
          </>
        )}
        <PlanBar selected={ready ? selected : null} />
      </div>
    </PreviewContext.Provider>
  );
}
