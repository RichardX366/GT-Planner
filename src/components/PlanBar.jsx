import { useState } from 'react';
import { Check, ClipboardCopy, Save } from 'lucide-react';
import { COURSES } from '../data/catalog.js';
import { usePlanner } from '../lib/store.jsx';

export function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copy these CRNs:', text);
    }
  };
  return [copied, copy];
}

export function hoursOf(sections) {
  return sections
    .filter((s) => COURSES[s.courseId].primaryType === s.type)
    .reduce((a, s) => a + COURSES[s.courseId].hours, 0);
}

export default function PlanBar({ selected, openPlan }) {
  const { plan, updatePlan } = usePlanner();
  const [copied, copy] = useCopy();
  const crns = selected ? selected.sections.map((s) => s.crn) : [];
  const isSaved = plan.saved && plan.saved.crns.slice().sort().join('-') === selected?.key;

  return (
    <footer className="planbar">
      <div className="planbar-info">
        <span>
          <b>Planned Hours:</b> {selected ? hoursOf(selected.sections) : 0}
        </span>
        <span className="sep">|</span>
        <span className="crns">
          <b>CRNs:</b> {crns.length ? crns.join(', ') : '—'}
        </span>
        {plan.saved && !isSaved && (
          <button className="link-btn" onClick={openPlan}>
            saved plan differs · view
          </button>
        )}
      </div>
      <div className="planbar-actions">
        <button className="btn ghost" disabled={!crns.length} onClick={() => copy(crns.join(', '))}>
          {copied ? <Check size={15} /> : <ClipboardCopy size={15} />} {copied ? 'Copied' : 'Copy CRNs'}
        </button>
        <button
          className="btn primary"
          disabled={!selected || isSaved}
          onClick={() => updatePlan(() => ({ saved: { crns, at: new Date().toISOString() } }))}
        >
          {isSaved ? <Check size={15} /> : <Save size={15} />} {isSaved ? 'Plan Saved' : 'Save Plan'}
        </button>
      </div>
    </footer>
  );
}
