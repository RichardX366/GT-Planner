import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'gt-planner-v1';

export const PALETTE = [
  '#80D8FF', '#FF9E80', '#B9F6CA', '#EA80FC', '#FFD180', '#A7FFEB',
  '#FF8A80', '#B388FF', '#CCFF90', '#F4FF81', '#84FFFF', '#CFD8DC',
];

export const defaultCriteria = () => ({
  earliestStart: { on: false, value: 9 * 60 },
  latestEnd: { on: false, value: 17 * 60 },
  daysOff: { on: false, days: ['F'] },
  seats: { on: true, mode: 'waitlist' },
  minGpa: { on: false, value: 3.0 },
  blocked: { on: false, items: [{ id: 'b1', label: 'Lunch', days: 'MTWRF', start: 12 * 60, end: 12 * 60 + 45 }] },
});

export function newPlan(name, courses = []) {
  return {
    id: Math.random().toString(36).slice(2, 9),
    name,
    courses,
    colors: Object.fromEntries(courses.map((c, i) => [c, PALETTE[i % PALETTE.length]])),
    pinned: [],
    excluded: [],
    bannedInstructors: {},
    forcedInstructors: {},
    criteria: defaultCriteria(),
    sortBy: 'best',
    selectedKey: null,
    saved: null, // { crns: [...], at: ISO string }
  };
}

function initialState() {
  const primary = newPlan('Primary', ['CS 1332', 'CS 2200', 'ECE 2031', 'LMC 3403', 'MATH 3012']);
  return { theme: 'dark', activePlanId: primary.id, plans: { [primary.id]: primary }, order: [primary.id] };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.plans && s.plans[s.activePlanId]) return s;
    }
  } catch {
    /* storage unavailable */
  }
  return initialState();
}

const Ctx = createContext(null);

export function PlannerProvider({ children }) {
  const [state, setState] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable */
    }
    document.documentElement.dataset.theme = state.theme;
  }, [state]);

  const plan = state.plans[state.activePlanId];

  const updatePlan = useCallback(
    (fn) =>
      setState((s) => {
        const p = s.plans[s.activePlanId];
        return { ...s, plans: { ...s.plans, [p.id]: { ...p, ...fn(p) } } };
      }),
    []
  );

  return <Ctx.Provider value={{ state, setState, plan, updatePlan }}>{children}</Ctx.Provider>;
}

export const usePlanner = () => useContext(Ctx);

export const toggleIn = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

export function nextColor(plan) {
  const used = new Set(Object.values(plan.colors));
  return PALETTE.find((c) => !used.has(c)) || PALETTE[plan.courses.length % PALETTE.length];
}
