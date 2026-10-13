import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { usePlanner, nextColor } from '../lib/store.jsx';
import { useData } from '../lib/data.jsx';

export function useAddCourse() {
  const { updatePlan } = usePlanner();
  return (id) =>
    updatePlan((p) =>
      p.courses.includes(id)
        ? {}
        : { courses: [...p.courses, id], colors: { ...p.colors, [id]: nextColor(p) }, selectedKey: null }
    );
}

export default function CourseAdd() {
  const { plan } = usePlanner();
  const { catalog } = useData();
  const add = useAddCourse();
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);

  const all = useMemo(() => Object.values(catalog.courses), [catalog]);
  const matches = useMemo(() => {
    const s = q.trim().toUpperCase().replace(/\s+/g, ' ');
    if (!s) return [];
    const compact = s.replace(/\s/g, '');
    const byId = [];
    const byTitle = [];
    for (const c of all) {
      if (plan.courses.includes(c.id)) continue;
      if ((c.subject + c.number).startsWith(compact)) byId.push(c);
      else if (s.length > 2 && c.title.toUpperCase().includes(s)) byTitle.push(c);
    }
    return [...byId, ...byTitle].slice(0, 10);
  }, [q, all, plan.courses]);

  const choose = (c) => {
    add(c.id);
    setQ('');
    setHi(0);
  };

  return (
    <div className="course-add">
      <div className="add-input">
        <Plus size={16} />
        <input
          value={q}
          placeholder="XX 0000 or course title"
          onChange={(e) => {
            setQ(e.target.value);
            setHi(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setHi((h) => Math.min(h + 1, matches.length - 1));
            if (e.key === 'ArrowUp') setHi((h) => Math.max(h - 1, 0));
            if (e.key === 'Enter' && matches[hi]) choose(matches[hi]);
            if (e.key === 'Escape') setQ('');
          }}
        />
      </div>
      {matches.length > 0 && (
        <ul className="suggest">
          {matches.map((c, i) => (
            <li key={c.id} className={i === hi ? 'hi' : ''} onMouseEnter={() => setHi(i)} onMouseDown={() => choose(c)}>
              <b>{c.id}</b>
              <span>{c.title}</span>
              <em>{c.hours} cr</em>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
