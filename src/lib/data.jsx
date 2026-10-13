import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  cachedGpas,
  createQueue,
  fetchGpa,
  fetchSeats,
  fetchTermRaw,
  fetchTerms,
  gpaKey,
  lookupInstructorGpa,
  lookupInstructorId,
  parseTermData,
  SEAT_TTL_MS,
} from './api.js';
import { idbGet, idbSet, lsGet, lsSet } from './cache.js';
import { usePlanner } from './store.jsx';

const Ctx = createContext(null);
const gpaQueue = createQueue(4);
const seatQueue = createQueue(4);

const TERMS_KEY = 'gt-planner-terms';
const SEATS_KEY = 'gt-planner-seats';
const SEAT_KEEP_MS = 24 * 60 * 60 * 1000; // cached seats older than this are dropped on save
const SEAT_FLUSH_MS = 400; // batch seat responses so the schedule list isn't recomputed per request

const EMPTY = { courses: {}, byCrn: {}, attributes: [], campuses: [], updatedAt: null };

export function DataProvider({ children }) {
  const { state, setState } = usePlanner();
  const term = state.term;
  const [terms, setTerms] = useState(() => lsGet(TERMS_KEY, []));
  // 'restoring' = reading the IndexedDB cache (render nothing yet), 'loading' = no cache, waiting on network
  const [catalog, setCatalog] = useState({ status: 'restoring', error: null, ...EMPTY });
  const [gpa, setGpa] = useState(cachedGpas);
  const [allSeats, setAllSeats] = useState(() => lsGet(SEATS_KEY, {}));
  const inflight = useRef(new Set());

  // Term list: cached copy first, refreshed in the background.
  useEffect(() => {
    fetchTerms()
      .then((list) => {
        setTerms(list);
        lsSet(TERMS_KEY, list);
        setState((s) => (s.term && list.includes(s.term) ? s : { ...s, term: list[list.length - 1] }));
      })
      .catch((e) => {
        if (!lsGet(TERMS_KEY, []).length) setCatalog((c) => ({ ...c, status: 'error', error: e.message }));
      });
  }, [setState]);

  // Catalog: stale-while-revalidate. Show the cached term instantly, then swap in
  // fresh crawler data only if it actually changed.
  useEffect(() => {
    if (!term) return;
    let cancelled = false;
    (async () => {
      const cached = await idbGet(`term:${term}`);
      if (cancelled) return;
      if (cached) setCatalog({ status: 'ready', error: null, ...parseTermData(cached) });
      else setCatalog({ status: 'loading', error: null, ...EMPTY });
      try {
        const raw = await fetchTermRaw(term);
        if (cancelled) return;
        if (!cached || raw.updatedAt !== cached.updatedAt) {
          setCatalog({ status: 'ready', error: null, ...parseTermData(raw) });
          idbSet(`term:${term}`, raw);
        }
      } catch (e) {
        if (!cancelled && !cached) setCatalog({ status: 'error', error: e.message, ...EMPTY });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [term]);

  const requestGpa = useCallback((ids) => {
    for (const id of ids) {
      const key = gpaKey(id);
      if (inflight.current.has(`gpa:${key}`)) continue;
      inflight.current.add(`gpa:${key}`);
      gpaQueue(() => fetchGpa(id))
        .then((d) => setGpa((g) => (g[key] && JSON.stringify(g[key]) === JSON.stringify(d) ? g : { ...g, [key]: d })))
        .catch(() => setGpa((g) => (g[key] ? g : { ...g, [key]: { course: null, instructors: {}, failed: true } })));
    }
  }, []);

  // Seats: cached counts are shown immediately; stale ones refetch quietly and
  // responses are applied in batches.
  const seats = allSeats[term] || {};
  const seatsRef = useRef(seats);
  seatsRef.current = seats;
  const pending = useRef({});
  const flushTimer = useRef(null);

  const flushSeats = useCallback(() => {
    flushTimer.current = null;
    const batch = pending.current;
    pending.current = {};
    setAllSeats((all) => {
      const next = { ...all };
      for (const [t, entries] of Object.entries(batch)) next[t] = { ...next[t], ...entries };
      return next;
    });
  }, []);

  const requestSeats = useCallback(
    (crns) => {
      if (!term) return;
      for (const crn of crns) {
        const key = `seat:${term}:${crn}`;
        const have = seatsRef.current[crn];
        if (inflight.current.has(key) || (have && Date.now() - have.at < SEAT_TTL_MS)) continue;
        inflight.current.add(key);
        seatQueue(() => fetchSeats(term, crn))
          .catch(() => (have && !have.failed ? { ...have, at: Date.now() } : { failed: true, at: Date.now() }))
          .then((d) => {
            (pending.current[term] ||= {})[crn] = d;
            if (!flushTimer.current) flushTimer.current = setTimeout(flushSeats, SEAT_FLUSH_MS);
          })
          .finally(() => inflight.current.delete(key));
      }
    },
    [term, flushSeats]
  );

  // Persist seats (debounced), dropping anything older than a day.
  useEffect(() => {
    const t = setTimeout(() => {
      const cutoff = Date.now() - SEAT_KEEP_MS;
      const pruned = {};
      for (const [tm, entries] of Object.entries(allSeats)) {
        const keep = Object.entries(entries).filter(([, v]) => v.at > cutoff && !v.failed);
        if (keep.length) pruned[tm] = Object.fromEntries(keep);
      }
      lsSet(SEATS_KEY, pruned);
    }, 1000);
    return () => clearTimeout(t);
  }, [allSeats]);

  const getGpa = useCallback((courseId) => gpa[gpaKey(courseId)], [gpa]);
  const instructorGpa = useCallback((courseId, name) => lookupInstructorGpa(gpa[gpaKey(courseId)], name), [gpa]);
  const instructorId = useCallback((courseId, name) => lookupInstructorId(gpa[gpaKey(courseId)], name), [gpa]);

  return (
    <Ctx.Provider value={{ term, terms, catalog, gpa, getGpa, seats, requestGpa, requestSeats, instructorGpa, instructorId }}>
      {children}
    </Ctx.Provider>
  );
}

export const useData = () => useContext(Ctx);
