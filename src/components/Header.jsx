import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Copy, Moon, Pencil, Plus, Sun, Trash2 } from 'lucide-react';
import { usePlanner, newPlan } from '../lib/store.jsx';
import { useData } from '../lib/data.jsx';
import { termLabel } from '../lib/api.js';

const TABS = [
  ['scheduler', 'Scheduler'],
  ['find', 'Find Classes'],
  ['plan', 'Registration Plan'],
];

export default function Header({ tab, setTab, selected }) {
  const { state, setState, plan } = usePlanner();
  const { terms, catalog } = useData();
  const credits = plan ? plan.courses.reduce((a, id) => a + (catalog.courses[id]?.hours || 0), 0) : 0;

  return (
    <header className="header">
      <div className="header-left">
        <div className="brand" onClick={() => setTab('scheduler')}>GT Planner</div>
        <label className="header-select term-select">
          <select value={state.term || ''} onChange={(e) => setState((s) => ({ ...s, term: e.target.value }))}>
            {!state.term && <option value="">Loading…</option>}
            {[...terms].reverse().map((t) => (
              <option key={t} value={t}>
                {termLabel(t)}
              </option>
            ))}
          </select>
          <ChevronDown size={16} />
        </label>
        {plan && <PlanMenu />}
        <div className="credits">{credits} Credits</div>
      </div>

      <nav className="tabs">
        {TABS.map(([k, label]) => (
          <button key={k} className={tab === k ? 'tab active' : 'tab'} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </nav>

      <div className="header-right">
        {selected && selected.violations.length > 0 && <span className="pill warn">Backup schedule</span>}
        <button
          className="icon-btn"
          title="Toggle theme"
          onClick={() => setState((s) => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' }))}
        >
          {state.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
}

function PlanMenu() {
  const { state, setState, plan } = usePlanner();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && (setOpen(false), setEditing(null));
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const termPlans = state.order.filter((id) => state.plans[id].term === state.term);

  const add = (copy) => {
    const name = copy ? `${plan.name} (copy)` : `Plan ${String.fromCharCode(65 + termPlans.length)}`;
    const p = copy
      ? { ...structuredClone(plan), id: newPlan('').id, name }
      : newPlan(name, state.term);
    setState((s) => ({ ...s, plans: { ...s.plans, [p.id]: p }, order: [...s.order, p.id], activePlanId: p.id }));
  };

  const remove = (id) =>
    setState((s) => {
      const order = s.order.filter((x) => x !== id);
      const plans = { ...s.plans };
      delete plans[id];
      const sameTerm = order.find((x) => plans[x].term === s.term);
      if (!sameTerm) return s;
      return { ...s, plans, order, activePlanId: s.activePlanId === id ? sameTerm : s.activePlanId };
    });

  const rename = (id, name) =>
    setState((s) => ({ ...s, plans: { ...s.plans, [id]: { ...s.plans[id], name: name || s.plans[id].name } } }));

  return (
    <div className="header-select plan-menu" ref={ref}>
      <button className="plain" onClick={() => setOpen((o) => !o)}>
        {plan.name} <ChevronDown size={16} />
      </button>
      {open && (
        <div className="menu">
          {termPlans.map((id) => {
            const p = state.plans[id];
            return (
              <div key={id} className={id === state.activePlanId ? 'menu-row active' : 'menu-row'}>
                {editing === id ? (
                  <input
                    autoFocus
                    defaultValue={p.name}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        rename(id, e.currentTarget.value.trim());
                        setEditing(null);
                      }
                      if (e.key === 'Escape') setEditing(null);
                    }}
                    onBlur={(e) => {
                      rename(id, e.currentTarget.value.trim());
                      setEditing(null);
                    }}
                  />
                ) : (
                  <button className="plain grow" onClick={() => setState((s) => ({ ...s, activePlanId: id }))}>
                    {id === state.activePlanId ? <Check size={14} /> : <span style={{ width: 14 }} />}
                    {p.name}
                  </button>
                )}
                <button className="icon-btn sm" title="Rename" onClick={() => setEditing(id)}>
                  <Pencil size={13} />
                </button>
                <button className="icon-btn sm" title="Delete" disabled={termPlans.length === 1} onClick={() => remove(id)}>
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
          <div className="menu-sep" />
          <button className="menu-action" onClick={() => add(false)}>
            <Plus size={14} /> New empty plan
          </button>
          <button className="menu-action" onClick={() => add(true)}>
            <Copy size={14} /> Duplicate “{plan.name}” as backup
          </button>
        </div>
      )}
    </div>
  );
}
