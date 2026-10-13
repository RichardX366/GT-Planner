import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'gt-planner-v3';

export const PALETTE = [
  '#80D8FF', '#FF9E80', '#B9F6CA', '#EA80FC', '#FFD180', '#A7FFEB',
  '#FF8A80', '#B388FF', '#CCFF90', '#F4FF81', '#84FFFF', '#CFD8DC',
];

export const defaultCriteria = () => ({
  earliestStart: { on: false, value: 9 * 60 },
  latestEnd: { on: false, value: 17 * 60 },
  daysOff: { on: false, days: ['F'] },
  seats: { on: true, mode: 'waitlist' },
  campus: { on: true, value: 'Georgia Tech-Atlanta' },
  minGpa: { on: false, value: 3.0 },
  blocked: { on: false, items: [{ id: 'b1', label: 'Lunch', days: 'MTWRF', start: 12 * 60, end: 12 * 60 + 45 }] },
});

export function newPlan(name, term, courses = []) {
  return {
    id: Math.random().toString(36).slice(2, 9),
    name,
    term,
    courses,
    colors: Object.fromEntries(courses.map((c, i) => [c, PALETTE[i % PALETTE.length]])),
    pinned: [],
    excluded: [],
    bannedInstructors: {},
    forcedInstructors: {},
    criteria: defaultCriteria(),
    sortBy: 'gpa',
    selectedKey: null,
    saved: null, // autosaved schedule: { crns: [...], at: ISO string }
  };
}

function initialState() {
  return { theme: 'dark', term: null, activePlanId: null, plans: {}, order: [] };
}

/** Make sure the active plan belongs to the selected term, creating a "Primary" plan if needed. */
function ensurePlan(s) {
  if (!s.term) return s;
  const active = s.plans[s.activePlanId];
  if (active && active.term === s.term) return s;
  const existing = s.order.find((id) => s.plans[id].term === s.term);
  if (existing) return { ...s, activePlanId: existing };
  const p = newPlan('Primary', s.term);
  return { ...s, plans: { ...s.plans, [p.id]: p }, order: [...s.order, p.id], activePlanId: p.id };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.plans) {
        for (const p of Object.values(s.plans)) {
          p.criteria = { ...defaultCriteria(), ...p.criteria };
          if (p.sortBy === 'best') p.sortBy = 'gpa'; // "Best Match" sort was removed
        }
        return ensurePlan(s);
      }
    }
  } catch {
    /* storage unavailable */
  }
  return initialState();
}

const Ctx = createContext(null);

export function PlannerProvider({ children }) {
  const [state, setRawState] = useState(load);
  // Every write goes through ensurePlan, so the active plan always matches the selected term.
  const setState = useCallback((fn) => setRawState((s) => ensurePlan(typeof fn === 'function' ? fn(s) : fn)), []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable */
    }
    document.documentElement.dataset.theme = state.theme;
  }, [state]);

  const plan = state.plans[state.activePlanId] || null;

  const updatePlan = useCallback(
    (fn) =>
      setState((s) => {
        const p = s.plans[s.activePlanId];
        if (!p) return s;
        return { ...s, plans: { ...s.plans, [p.id]: { ...p, ...fn(p) } } };
      }),
    [setState]
  );

  return <Ctx.Provider value={{ state, setState, plan, updatePlan }}>{children}</Ctx.Provider>;
}

export const usePlanner = () => useContext(Ctx);

export const toggleIn = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

export function nextColor(plan) {
  const used = new Set(Object.values(plan.colors));
  return PALETTE.find((c) => !used.has(c)) || PALETTE[plan.courses.length % PALETTE.length];
}
