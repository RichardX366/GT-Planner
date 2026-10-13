import { useState } from 'react';
import { Check, ClipboardCopy } from 'lucide-react';

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
  return sections.reduce((a, s) => a + (s.hours || 0), 0);
}

export default function PlanBar({ selected }) {
  const [copied, copy] = useCopy();
  const crns = selected ? selected.sections.map((s) => s.crn) : [];

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
      </div>
      <div className="planbar-actions">
        <button className="btn primary" disabled={!crns.length} onClick={() => copy(crns.join(', '))}>
          {copied ? <Check size={15} /> : <ClipboardCopy size={15} />} {copied ? 'Copied' : 'Copy CRNs'}
        </button>
      </div>
    </footer>
  );
}
