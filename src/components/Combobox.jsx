import { useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

/**
 * Typeable select. `options` is [{ value, label, hint }]; value '' means "none".
 * Typing filters (prefix matches first); Enter/click picks; blur snaps back to a valid value.
 */
export default function Combobox({ value, onChange, options, placeholder, emptyLabel = 'Any' }) {
  const id = useId();
  const [text, setText] = useState(null); // null = not editing, show the selected label
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const listRef = useRef(null);

  const selected = options.find((o) => o.value === value);
  const query = (text ?? '').trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!query) return options;
    const starts = [];
    const contains = [];
    for (const o of options) {
      const v = o.value.toLowerCase();
      const l = (o.label || '').toLowerCase();
      if (v.startsWith(query) || l.startsWith(query)) starts.push(o);
      else if (l.includes(query)) contains.push(o);
    }
    return [...starts, ...contains];
  }, [options, query]);

  const choose = (o) => {
    onChange(o ? o.value : '');
    setText(null);
    setOpen(false);
  };

  const commit = () => {
    if (text == null) return setOpen(false);
    if (!query) return choose(null);
    const exact = options.find((o) => o.value.toLowerCase() === query || (o.label || '').toLowerCase() === query);
    choose(exact || (filtered.length === 1 ? filtered[0] : selected));
  };

  const move = (d) => {
    const next = Math.max(0, Math.min(filtered.length - 1, hi + d));
    setHi(next);
    listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' });
  };

  return (
    <div className="combobox">
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        value={text ?? (selected ? selected.value : '')}
        placeholder={placeholder || emptyLabel}
        onFocus={(e) => {
          setOpen(true);
          setHi(0);
          e.target.select();
        }}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setHi(0);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            open ? move(1) : setOpen(true);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            move(-1);
          } else if (e.key === 'Enter' && open) {
            e.preventDefault(); // pick the option instead of submitting the form
            choose(filtered[hi] || selected);
          } else if (e.key === 'Escape') {
            setText(null);
            setOpen(false);
          }
        }}
      />
      {value ? (
        <button type="button" className="combobox-icon" title="Clear" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(null)}>
          <X size={14} />
        </button>
      ) : (
        <ChevronDown size={15} className="combobox-icon passive" />
      )}
      {open && (
        <ul className="combobox-list" id={`${id}-list`} role="listbox" ref={listRef}>
          {filtered.length ? (
            filtered.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                className={`${i === hi ? 'hi' : ''} ${o.value === value ? 'sel' : ''}`}
                onMouseEnter={() => setHi(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o);
                }}
              >
                <b>{o.value}</b>
                {o.label && <span>{o.label}</span>}
                {o.hint && <em>{o.hint}</em>}
              </li>
            ))
          ) : (
            <li className="empty">No matching subjects</li>
          )}
        </ul>
      )}
    </div>
  );
}
