import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from './data.jsx';
import { gpaKey } from './api.js';
import { lsGet, lsSet } from './cache.js';
import { hydrateResult } from './scheduler.js';

const RESULTS_KEY = 'gt-planner-results';
const DEBOUNCE_MS = 120;

export const EMPTY_RESULT = {
  matches: [],
  backups: [],
  matchCount: 0,
  backupCount: 0,
  total: 0,
  truncated: false,
  emptyCourses: [],
  impact: {},
  conflicts: {},
};

/**
 * Schedule combinations for a plan, computed in a Web Worker.
 * The last result (cached per plan in localStorage) stays on screen until a new
 * one is ready, so the list never blanks out while it recalculates.
 */
export function useSchedules(plan, ready) {
  const { catalog, seats, gpa } = useData();
  const [results, setResults] = useState(() => lsGet(RESULTS_KEY, {}));
  const [pending, setPending] = useState(false);
  const workerRef = useRef(null);
  const latest = useRef({ id: 0, planId: null });

  useEffect(() => {
    const w = new Worker(new URL('./scheduler.worker.js', import.meta.url), { type: 'module' });
    w.onmessage = ({ data }) => {
      if (data.id !== latest.current.id) return; // superseded by a newer request
      setResults((r) => {
        const next = { ...r, [latest.current.planId]: data.result };
        lsSet(RESULTS_KEY, next);
        return next;
      });
      setPending(false);
    };
    workerRef.current = w;
    return () => w.terminate();
  }, []);

  // Only what affects generation; selecting a schedule must not trigger a recompute.
  const planInputs = plan && {
    courses: plan.courses,
    pinned: plan.pinned,
    excluded: plan.excluded,
    bannedInstructors: plan.bannedInstructors,
    forcedInstructors: plan.forcedInstructors,
    criteria: plan.criteria,
    sortBy: plan.sortBy,
  };
  const inputsKey = JSON.stringify(planInputs);

  const courses = useMemo(
    () => (ready ? Object.fromEntries(plan.courses.filter((id) => catalog.courses[id]).map((id) => [id, catalog.courses[id]])) : {}),
    [ready, catalog, inputsKey] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const crns = Object.values(courses).flatMap((c) => c.sections.map((s) => s.crn));
  // Drop fetch timestamps: a refetch that returns the same counts shouldn't trigger a recompute.
  const seatSubset = Object.fromEntries(
    crns.filter((c) => seats[c]).map((c) => {
      const { at, ...counts } = seats[c]; // eslint-disable-line no-unused-vars
      return [c, counts];
    })
  );
  const gpaSubset = Object.fromEntries(Object.keys(courses).map(gpaKey).filter((k) => gpa[k]).map((k) => [k, gpa[k]]));
  const seatKey = JSON.stringify(seatSubset);
  const gpaKeyStr = JSON.stringify(gpaSubset);

  useEffect(() => {
    if (!ready || !workerRef.current) return;
    setPending(true);
    const t = setTimeout(() => {
      latest.current = { id: latest.current.id + 1, planId: plan.id };
      workerRef.current.postMessage({
        id: latest.current.id,
        courseIds: plan.courses,
        plan: planInputs,
        courses,
        seats: seatSubset,
        gpa: gpaSubset,
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [ready, plan?.id, inputsKey, courses, seatKey, gpaKeyStr]); // eslint-disable-line react-hooks/exhaustive-deps

  const raw = plan ? results[plan.id] : null;
  const result = useMemo(
    () => (raw && catalog.status === 'ready' ? hydrateResult(raw, catalog.byCrn) : null),
    [raw, catalog]
  );

  return { result: result ? { conflicts: {}, ...result } : EMPTY_RESULT, hasResult: !!result, pending };
}
