import { DAYS, daysOf, fmtTime } from './time.js';

const SHOW_LIMIT = 60;

export const SORTS = {
  gpa: 'Highest Professor GPA',
  compact: 'Most Compact',
  earliestEnd: 'Earliest Ending',
  latestStart: 'Latest Starting',
  fewestDays: 'Fewest Days on Campus',
};

export const CRITERIA_LABELS = {
  earliestStart: 'Start time',
  latestEnd: 'End time',
  daysOff: 'Days off',
  seats: 'Open seats',
  minGpa: 'Prof GPA',
  blocked: 'Blocked time',
};

/** seat: { cap, filled, wlCap, wlFilled } from the seat proxy, or undefined while loading. */
export function seatStatus(seat) {
  if (!seat) return { kind: 'unknown', label: 'Loading seats…' };
  if (seat.failed) return { kind: 'unknown', label: 'Seats unavailable' };
  if (seat.filled < seat.cap) return { kind: 'open', label: `${seat.cap - seat.filled} of ${seat.cap} seats` };
  if (seat.wlCap > seat.wlFilled) return { kind: 'waitlist', label: `Full · ${seat.wlCap - seat.wlFilled} of ${seat.wlCap} waitlist` };
  return { kind: 'full', label: 'Full · waitlist closed' };
}

export const isLead = (course, s) => course.leads.includes(s);

/** All valid section bundles (lead section + linked lab when the course has one). */
export function courseBundles(course, plan) {
  const excluded = new Set(plan.excluded);
  const pinned = new Set(plan.pinned);
  const banned = plan.bannedInstructors[course.id] || [];
  const forced = plan.forcedInstructors[course.id] || [];
  const campus = plan.criteria.campus;
  const ok = (s) => !excluded.has(s.crn) && (!campus?.on || s.campus === campus.value);

  let leads = course.leads.filter(ok).filter((s) => !banned.includes(s.instructor));
  if (forced.length) leads = leads.filter((s) => forced.includes(s.instructor));
  const pinnedLeads = leads.filter((s) => pinned.has(s.crn));
  if (pinnedLeads.length) leads = pinnedLeads;

  if (!course.hasLab) return leads.map((s) => [s]);

  const byCrn = Object.fromEntries(course.labs.map((l) => [l.crn, l]));
  const labs = course.labs.filter(ok);
  const pinnedLabs = new Set(labs.filter((l) => pinned.has(l.crn)).map((l) => l.crn));
  const labOk = (crn) => byCrn[crn] && labs.includes(byCrn[crn]) && (!pinnedLabs.size || pinnedLabs.has(crn));

  return leads.flatMap((lead) =>
    lead.labCrns.length ? lead.labCrns.filter(labOk).map((crn) => [lead, byCrn[crn]]) : pinnedLabs.size ? [] : [[lead]]
  );
}

function expand(sections) {
  const out = [];
  for (const s of sections)
    for (const m of s.meetings)
      for (const d of daysOf(m.days)) out.push({ day: d, start: m.start, end: m.end, crn: s.crn });
  return out;
}

const overlaps = (a, b) => a.day === b.day && a.start < b.end && b.start < a.end;

/**
 * GPA used for scoring a lead section: its professor's Course Critique GPA, or the course's
 * average when the professor has no data (so an unknown professor counts as typical).
 * Null only when the course itself has no data; such courses are left out of the average.
 */
function leadGpa(ctx, s) {
  return ctx.instructorGpa(s.courseId, s.instructor) ?? ctx.courseGpa?.(s.courseId) ?? null;
}

function evaluate(sections, criteria, ctx) {
  const meetings = expand(sections);
  const byDay = Object.fromEntries(DAYS.map((d) => [d, []]));
  meetings.forEach((m) => byDay[m.day]?.push(m));

  let gaps = 0;
  let starts = 0;
  let ends = 0;
  let used = 0;
  for (const d of DAYS) {
    const list = byDay[d].sort((a, b) => a.start - b.start);
    if (!list.length) continue;
    used++;
    starts += list[0].start;
    ends += list[list.length - 1].end;
    for (let i = 1; i < list.length; i++) gaps += Math.max(0, list[i].start - list[i - 1].end);
  }

  // Credit-hour weighted instructor GPA for the lead section of each course.
  let gpaSum = 0;
  let gpaHours = 0;
  const leads = sections.filter((s) => isLead(ctx.courses[s.courseId], s));
  for (const s of leads) {
    const g = leadGpa(ctx, s);
    if (g != null) {
      const w = Math.max(s.hours, 1);
      gpaSum += g * w;
      gpaHours += w;
    }
  }
  const gpa = gpaHours ? gpaSum / gpaHours : null;

  const violations = [];
  const c = criteria;
  if (c.earliestStart.on && meetings.some((m) => m.start < c.earliestStart.value))
    violations.push({ key: 'earliestStart', text: `Class before ${fmtTime(c.earliestStart.value)}` });
  if (c.latestEnd.on && meetings.some((m) => m.end > c.latestEnd.value))
    violations.push({ key: 'latestEnd', text: `Class after ${fmtTime(c.latestEnd.value)}` });
  if (c.daysOff.on && c.daysOff.days.some((d) => byDay[d].length))
    violations.push({ key: 'daysOff', text: `Class on ${c.daysOff.days.filter((d) => byDay[d].length).join('')}` });
  if (c.seats.on) {
    const bad = sections.filter((s) => {
      const k = seatStatus(ctx.seats[s.crn]).kind;
      return c.seats.mode === 'open' ? k === 'waitlist' || k === 'full' : k === 'full';
    });
    if (bad.length) violations.push({ key: 'seats', text: `${bad.map((s) => `${s.courseId} ${s.section}`).join(', ')} full` });
  }
  if (c.minGpa.on) {
    const low = leads.filter((s) => {
      const g = ctx.instructorGpa(s.courseId, s.instructor);
      return g != null && g < c.minGpa.value;
    });
    if (low.length) violations.push({ key: 'minGpa', text: `${low.map((s) => s.courseId).join(', ')} prof < ${c.minGpa.value.toFixed(2)}` });
  }
  if (c.blocked.on && c.blocked.items.length) {
    const blocks = c.blocked.items.flatMap((b) => daysOf(b.days).map((d) => ({ day: d, start: b.start, end: b.end, label: b.label })));
    const hit = blocks.filter((b) => meetings.some((m) => overlaps(m, b)));
    if (hit.length) violations.push({ key: 'blocked', text: `Overlaps ${[...new Set(hit.map((h) => h.label || 'blocked time'))].join(', ')}` });
  }

  return {
    sections,
    key: sections.map((s) => s.crn).sort().join('-'),
    sig: signature(sections),
    gpa,
    gaps,
    days: used,
    avgStart: used ? starts / used : 0,
    avgEnd: used ? ends / used : 0,
    violations,
  };
}

/**
 * What a schedule "looks like" (course, professor, times) independent of which
 * interchangeable CRN represents it, so a selection survives recalculation.
 */
export function signature(sections) {
  return sections
    .map((s) => `${s.courseId}|${s.type}|${s.instructor}|${s.meetings.map((m) => `${m.days}${m.start}-${m.end}`).join(',')}`)
    .sort()
    .join('#');
}

/** Combos as plain data (CRNs instead of section objects) for the worker and localStorage. */
export function serializeResult(r) {
  const strip = ({ sections, ...rest }) => ({ ...rest, crns: sections.map((s) => s.crn) });
  return { ...r, matches: r.matches.map(strip), backups: r.backups.map(strip) };
}

export function hydrateResult(r, byCrn) {
  const fill = (list) =>
    list.flatMap(({ crns, ...rest }) => {
      const sections = crns.map((c) => byCrn[c]);
      return sections.every(Boolean) ? [{ ...rest, sections }] : [];
    });
  return { ...r, matches: fill(r.matches), backups: fill(r.backups) };
}

const comparators = {
  gpa: (a, b) => (b.gpa ?? 0) - (a.gpa ?? 0) || a.gaps - b.gaps,
  compact: (a, b) => a.gaps - b.gaps || a.days - b.days || (b.gpa ?? 0) - (a.gpa ?? 0),
  earliestEnd: (a, b) => a.avgEnd - b.avgEnd || a.gaps - b.gaps,
  latestStart: (a, b) => b.avgStart - a.avgStart || a.gaps - b.gaps,
  fewestDays: (a, b) => a.days - b.days || a.gaps - b.gaps,
};

const SEAT_RANK = { open: 0, unknown: 1, waitlist: 2, full: 3 };

// ---------- search: best-first ordering + branch and bound ----------

const TIME_BUDGET_MS = 2000; // safety valve for huge plans; results so far are still the best found
const VIOLATION_BITS = Object.fromEntries(Object.keys(CRITERIA_LABELS).map((k, i) => [k, 1 << i]));
const popcount = (m) => {
  let c = 0;
  for (; m; m &= m - 1) c++;
  return c;
};

/** Per-day start/end/gaps and GPA totals for a partial schedule (no overlaps by construction). */
function partialStats(sections, ctx) {
  const byDay = {};
  for (const s of sections)
    for (const m of s.meetings) for (const d of daysOf(m.days)) (byDay[d] ||= []).push(m);
  let gaps = 0;
  let sumStart = 0;
  let sumEnd = 0;
  const days = new Set();
  const holes = []; // [day, start, end] of each gap between classes
  for (const [d, list] of Object.entries(byDay)) {
    list.sort((a, b) => a.start - b.start);
    days.add(d);
    sumStart += list[0].start;
    sumEnd += list[list.length - 1].end;
    for (let i = 1; i < list.length; i++) {
      const g = list[i].start - list[i - 1].end;
      if (g > 0) {
        gaps += g;
        holes.push([d, list[i - 1].end, list[i].start]);
      }
    }
  }
  let S = 0;
  let W = 0;
  for (const s of sections) {
    if (!isLead(ctx.courses[s.courseId], s)) continue;
    const g = leadGpa(ctx, s);
    if (g != null) {
      S += g * Math.max(s.hours, 1);
      W += Math.max(s.hours, 1);
    }
  }
  return { gaps, holes, sumStart, sumEnd, days, S, W };
}

/**
 * Highest weighted-average GPA any completion could reach, ignoring time conflicts
 * (so it's a true upper bound). Binary search on t: is Σ(g − t)·w ≥ 0 achievable?
 */
function gpaUpperBound(S, W, rest) {
  if (!rest.length) return W ? S / W : 0;
  if (!W) {
    // Average of whatever gets chosen can't exceed the largest single GPA available.
    let best = 0;
    for (const opts of rest) for (const o of opts) if (o.g != null) best = Math.max(best, o.g);
    return best;
  }
  const ok = (t) => {
    let total = S - t * W;
    for (const opts of rest) {
      let best = -Infinity;
      for (const o of opts) best = Math.max(best, o.g == null ? 0 : (o.g - t) * o.w);
      total += best;
    }
    return total >= 0;
  };
  let lo = 0;
  let hi = 5;
  for (let k = 0; k < 24; k++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) lo = mid;
    else hi = mid;
  }
  return hi;
}

/**
 * Each sort as a tuple to minimize, in the same order the comparators break ties.
 * Pruning compares whole tuples, so a branch that can only tie the 60th result is skipped
 * too (a tie would never be inserted).
 */
const keyOf = {
  gpa: (r) => [-(r.gpa ?? 0), r.gaps],
  compact: (r) => [r.gaps, r.days, -(r.gpa ?? 0)],
  earliestEnd: (r) => [r.avgEnd, r.gaps],
  latestStart: (r) => [-r.avgStart, r.gaps],
  fewestDays: (r) => [r.days, r.gaps],
};

/**
 * Optimistic (lowest possible) key for any completion of this branch. Each part is bounded
 * independently, which still gives a valid lower bound on the tuple.
 */
function optimisticKey(sortBy, st, rest) {
  const n = st.days.size;
  const restDays = new Set();
  rest.forEach((opts) => opts.forEach((o) => o.days.forEach((d) => !st.days.has(d) && restDays.add(d))));
  const K = restDays.size; // most new days the rest could add

  // Existing gaps only shrink by class time that lands inside them. Each remaining course
  // contributes one option, so credit it with its single best option's total overlap.
  // Gaps the remaining courses create among themselves are ignored (still a lower bound).
  const gaps = () => {
    if (!st.holes.length) return 0;
    let fill = 0;
    for (const opts of rest) {
      let best = 0;
      for (const o of opts) {
        let ov = 0;
        for (const m of o.ms)
          for (const [d, a, b] of st.holes) if (m.day === d) ov += Math.max(0, Math.min(b, m.end) - Math.max(a, m.start));
        if (ov > best) best = ov;
      }
      fill += best;
    }
    return Math.max(0, st.gaps - fill);
  };
  // Every remaining course must add at least its fewest new days; they may share them.
  const days = () =>
    n + rest.reduce((a, opts) => Math.max(a, Math.min(...opts.map((o) => o.days.filter((d) => !st.days.has(d)).length))), 0);
  const gpa = () => -gpaUpperBound(st.S, st.W, rest);
  // Day ends only get later; a new day ends no earlier than the earliest remaining class end.
  const avgEnd = () => {
    const m = Math.min(Infinity, ...rest.flatMap((opts) => opts.map((o) => o.minEnd)));
    if (!n) return K ? m : 0;
    return K && m < st.sumEnd / n ? (st.sumEnd + K * m) / (n + K) : st.sumEnd / n;
  };
  // Day starts only get earlier; a new day starts no later than the latest remaining class start.
  const negAvgStart = () => {
    const M = Math.max(-Infinity, ...rest.flatMap((opts) => opts.map((o) => o.maxStart)));
    if (!n) return -(K ? M : 0);
    return -(K && M > st.sumStart / n ? (st.sumStart + K * M) / (n + K) : st.sumStart / n);
  };

  switch (sortBy) {
    case 'compact':
      return [gaps(), days(), gpa()];
    case 'earliestEnd':
      return [avgEnd(), gaps()];
    case 'latestStart':
      return [negAvgStart(), gaps()];
    case 'fewestDays':
      return [days(), gaps()];
    default:
      return [gpa(), gaps()];
  }
}

/** True if no completion can rank strictly ahead of `worst` (ties lose, see insertTop). */
function cannotBeat(sortBy, bound, worst) {
  const w = keyOf[sortBy](worst);
  for (let i = 0; i < bound.length; i++) {
    if (bound[i] < w[i] - 1e-9) return false;
    if (bound[i] > w[i] + 1e-9) return true;
  }
  return true;
}

function insertTop(list, item, cmp, cap) {
  if (list.length >= cap && cmp(item, list[list.length - 1]) >= 0) return;
  let i = list.length;
  list.push(item);
  while (i > 0 && cmp(list[i - 1], item) > 0) {
    list[i] = list[i - 1];
    i--;
  }
  list[i] = item;
  if (list.length > cap) list.pop();
}

const bundleTimes = (bundle) =>
  bundle
    .flatMap((s) => s.meetings.map((m) => `${m.days}${m.start}-${m.end}`))
    .sort()
    .join(',');

/**
 * Each course's options, with time-identical sections collapsed into their best version:
 * one representative among sections that follow every rule (`clean`) and one among those
 * that break a rule (`viol`). Best = highest professor GPA, then best seats. Every other
 * measure (gaps, days, start/end) depends only on times, so nothing better is lost.
 */
function prepareOptions(courseIds, plan, ctx) {
  const courses = [];
  const emptyCourses = [];
  for (const id of courseIds) {
    const course = ctx.courses[id];
    if (!course) continue;
    const bundles = courseBundles(course, plan);
    if (!bundles.length) {
      emptyCourses.push(id);
      continue;
    }
    const groups = { clean: new Map(), viol: new Map() };
    for (const bundle of bundles) {
      const ms = expand(bundle);
      const lead = bundle.find((s) => isLead(course, s));
      const g = lead ? leadGpa(ctx, lead) : null;
      const violations = evaluate(bundle, plan.criteria, ctx).violations;
      const o = {
        bundle,
        ms,
        viol: violations.length > 0,
        mask: violations.reduce((m, v) => m | VIOLATION_BITS[v.key], 0),
        g,
        w: lead && g != null ? Math.max(lead.hours, 1) : 0,
        days: [...new Set(ms.map((m) => m.day))],
        minutes: ms.reduce((a, m) => a + m.end - m.start, 0),
        minStart: ms.length ? Math.min(...ms.map((m) => m.start)) : Infinity,
        maxStart: ms.length ? Math.max(...ms.map((m) => m.start)) : -Infinity,
        minEnd: ms.length ? Math.min(...ms.map((m) => m.end)) : Infinity,
        maxEnd: ms.length ? Math.max(...ms.map((m) => m.end)) : 0,
        seat: Math.max(...bundle.map((s) => SEAT_RANK[seatStatus(ctx.seats[s.crn]).kind])),
      };
      const map = o.viol ? groups.viol : groups.clean;
      const key = bundleTimes(bundle);
      const cur = map.get(key);
      if (!cur || (o.g ?? -1) > (cur.g ?? -1) || ((o.g ?? -1) === (cur.g ?? -1) && o.seat < cur.seat)) map.set(key, o);
    }
    const byGpa = (a, b) => (b.g ?? -1) - (a.g ?? -1) || a.seat - b.seat;
    courses.push({ id, clean: [...groups.clean.values()].sort(byGpa), viol: [...groups.viol.values()].sort(byGpa) });
  }
  return { courses, emptyCourses };
}

/** Max-heap keyed by `score`. */
class Heap {
  constructor() {
    this.a = [];
  }
  get size() {
    return this.a.length;
  }
  push(x) {
    const a = this.a;
    a.push(x);
    for (let i = a.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (a[p].score >= a[i].score) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].score > a[m].score) m = l;
        if (r < a.length && a[r].score > a[m].score) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

/** Every way to pick k of the given indexes. */
function choose(items, k) {
  if (k === 0) return [[]];
  const out = [];
  (function rec(start, acc) {
    if (acc.length === k) return out.push([...acc]);
    for (let i = start; i < items.length; i++) rec(i + 1, [...acc, items[i]]);
  })(0, []);
  return out;
}

const hasConflict = (opts) => {
  for (let i = 0; i < opts.length; i++)
    for (let j = i + 1; j < opts.length; j++)
      if (opts[i].ms.some((m) => opts[j].ms.some((n) => overlaps(m, n)))) return true;
  return false;
};

/**
 * Highest Professor GPA, best-first: start from every course's best option, pop the best
 * remaining combination, skip it if it has a time conflict, and expand its neighbors (one
 * course moved to its next-best option). The weighted GPA adds up course by course, so
 * combinations come out in exact score order; stop once `cap` are found and nothing left
 * can tie them. `k` = exactly how many courses use a rule-breaking option.
 */
function bestFirstGpa(courses, k, cap, ctx, plan, run) {
  const cmp = comparators.gpa;
  const results = [];
  const heap = new Heap();
  const seen = new Set();
  const violCourses = courses.map((c, i) => (c.viol.length ? i : -1)).filter((i) => i >= 0);

  const subsets = choose(violCourses, k).map((sub) => courses.map((c, i) => (sub.includes(i) ? c.viol : c.clean)));
  const scoreOf = (lists, idx) => {
    let S = 0;
    let W = 0;
    lists.forEach((l, c) => {
      const o = l[idx[c]];
      if (o.g != null) {
        S += o.g * o.w;
        W += o.w;
      }
    });
    return W ? S / W : 0;
  };
  const push = (si, idx) => {
    const key = `${si}:${idx.join(',')}`;
    if (seen.has(key)) return;
    seen.add(key);
    heap.push({ score: scoreOf(subsets[si], idx), si, idx });
  };
  subsets.forEach((lists, si) => lists.every((l) => l.length) && push(si, lists.map(() => 0)));

  while (heap.size) {
    if (run.timeUp()) break;
    const top = heap.pop();
    // Results are kept by (GPA desc, gaps asc); anything strictly lower than the cap-th can't place.
    if (results.length >= cap && top.score < (results[cap - 1].gpa ?? 0) - 1e-9) break;
    const lists = subsets[top.si];
    const picked = lists.map((l, c) => l[top.idx[c]]);
    if (!hasConflict(picked)) insertTop(results, evaluate(picked.flatMap((o) => o.bundle), plan.criteria, ctx), cmp, cap);
    for (let c = 0; c < lists.length; c++)
      if (top.idx[c] + 1 < lists[c].length) {
        const next = [...top.idx];
        next[c]++;
        push(top.si, next);
      }
  }
  return results;
}

/**
 * Time-shape sorts (compact, days, start/end) don't add up course by course, so these use
 * a depth-first search over the time-grouped options with branch-and-bound pruning.
 * `k` = exactly how many courses use a rule-breaking option.
 */
function branchAndBound(courses, k, cap, ctx, plan, sortBy, run) {
  const cmp = comparators[sortBy];
  const order = courses
    .map((c) => (k === 0 ? c.clean : [...c.clean, ...c.viol]))
    .map((opts, i) => ({ opts, hasViol: k > 0 && courses[i].viol.length > 0 }))
    .sort((a, b) => a.opts.length - b.opts.length);
  const violLeft = order.map((_, i) => order.slice(i).filter((c) => c.hasViol).length);
  const results = [];
  const chosen = [];
  const busy = [];

  const keyNow = (sections) => {
    const st = partialStats(sections, ctx);
    const n = st.days.size;
    return keyOf[sortBy]({ gaps: st.gaps, days: n, avgEnd: n ? st.sumEnd / n : 0, avgStart: n ? st.sumStart / n : 0, gpa: st.W ? st.S / st.W : null });
  };
  // Try each course's most promising options first (ranked once, up front: re-ranking at every
  // step costs more than it saves), so strong schedules turn up early and the cutoff tightens.
  const promise = {
    compact: (o) => o.days.length,
    fewestDays: (o) => o.days.length,
    earliestEnd: (o) => o.maxEnd,
    latestStart: (o) => -o.minStart,
  }[sortBy];
  order.forEach((c) =>
    c.opts.sort((a, b) => a.viol - b.viol || promise(a) - promise(b) || (b.g ?? -1) - (a.g ?? -1) || a.seat - b.seat)
  );

  (function dfs(i, count) {
    if (run.timeUp()) return;
    if (count > k || count + violLeft[i] < k) return;
    if (i === order.length) {
      if (count !== k) return;
      if (results.length >= cap && cannotBeat(sortBy, keyNow(chosen.flat()), results[results.length - 1])) return;
      insertTop(results, evaluate(chosen.flat(), plan.criteria, ctx), cmp, cap);
      return;
    }
    if (i > 0 && results.length >= cap) {
      const bound = optimisticKey(sortBy, partialStats(chosen.flat(), ctx), order.slice(i).map((c) => c.opts));
      if (cannotBeat(sortBy, bound, results[results.length - 1])) return;
    }
    for (const o of order[i].opts) {
      if (o.ms.some((m) => busy.some((b) => overlaps(m, b)))) continue;
      chosen.push(o.bundle);
      busy.push(...o.ms);
      dfs(i + 1, count + (o.viol ? 1 : 0));
      busy.length -= o.ms.length;
      chosen.pop();
    }
  })(0, 0);
  return results;
}

/**
 * Best schedules for a plan, in tiers: first only sections that follow every rule (the
 * matches); then, while fewer than SHOW_LIMIT backups are found, allow exactly one more
 * course to use a rule-breaking section. Backups rank by how many courses break a rule,
 * then by the chosen sort. ctx: { courses, seats, instructorGpa, courseGpa }
 */
export function generateSchedules(courseIds, plan, ctx) {
  const { courses, emptyCourses } = prepareOptions(courseIds, plan, ctx);
  if (!courses.length || emptyCourses.length) return { matches: [], backups: [], truncated: false, emptyCourses };

  const sortBy = comparators[plan.sortBy] ? plan.sortBy : 'gpa';
  const started = performance.now();
  let truncated = false;
  const run = {
    timeUp: () => truncated || (performance.now() - started > TIME_BUDGET_MS && (truncated = true)),
  };
  const search = (k, cap) =>
    sortBy === 'gpa' ? bestFirstGpa(courses, k, cap, ctx, plan, run) : branchAndBound(courses, k, cap, ctx, plan, sortBy, run);

  const matches = search(0, SHOW_LIMIT);
  const backups = [];
  const maxK = courses.filter((c) => c.viol.length).length;
  for (let k = 1; k <= maxK && backups.length < SHOW_LIMIT && !truncated; k++)
    backups.push(...search(k, SHOW_LIMIT - backups.length).map((r) => ({ ...r, broken: k })));

  return { matches, backups, truncated, emptyCourses };
}

export const _internals = { prepareOptions, evaluate, comparators, hasConflict };

// ---------- per-section time conflicts ----------

const timeKey = (bundle) =>
  bundle
    .flatMap((s) => s.meetings.map((m) => `${m.days}${m.start}-${m.end}`))
    .sort()
    .join(',');

/** One bundle per distinct set of meeting times (instructors don't matter for conflicts). */
function uniqueByTime(bundles) {
  const seen = new Map();
  for (const b of bundles) if (!seen.has(timeKey(b))) seen.set(timeKey(b), b);
  return [...seen.values()];
}

/** Every lecture/lab pairing for a course, ignoring that course's own pins and bans. */
function rawBundles(course, plan) {
  const campus = plan.criteria.campus;
  const ok = (s) => !campus?.on || s.campus === campus.value;
  const leads = course.leads.filter(ok);
  if (!course.hasLab) return leads.map((s) => [s]);
  const byCrn = Object.fromEntries(course.labs.filter(ok).map((l) => [l.crn, l]));
  return leads.flatMap((lead) =>
    lead.labCrns.length ? lead.labCrns.filter((c) => byCrn[c]).map((c) => [lead, byCrn[c]]) : [[lead]]
  );
}

const STEP_BUDGET = 200000;

/**
 * Sections that can't be in any conflict-free schedule given the other courses
 * (with their pins/bans applied). Returns { crn: [courseIds it directly clashes with] };
 * an empty list means it only clashes with a combination of courses.
 */
export function findConflicts(courseIds, plan, courses) {
  const ids = courseIds.filter((id) => courses[id]);
  const options = Object.fromEntries(
    ids.map((id) => [id, uniqueByTime(courseBundles(courses[id], plan)).map(expand)])
  );
  const out = {};

  for (const id of ids) {
    // Courses with no sections left are reported elsewhere; don't let them hatch everything.
    const others = ids
      .filter((o) => o !== id && options[o].length)
      .map((o) => ({ id: o, opts: options[o] }))
      .sort((a, b) => a.opts.length - b.opts.length);
    if (!others.length) continue;

    let steps = 0;
    const canComplete = (busy, i) => {
      if (i === others.length || ++steps > STEP_BUDGET) return true; // over budget: assume it fits
      for (const ms of others[i].opts) {
        if (ms.some((m) => busy.some((b) => overlaps(m, b)))) continue;
        if (canComplete([...busy, ...ms], i + 1)) return true;
      }
      return false;
    };

    const feasibleByTime = new Map();
    const feasible = new Set();
    const checked = new Set();
    for (const bundle of rawBundles(courses[id], plan)) {
      bundle.forEach((s) => checked.add(s.crn));
      const key = timeKey(bundle);
      if (!feasibleByTime.has(key)) {
        steps = 0;
        feasibleByTime.set(key, canComplete(expand(bundle), 0));
      }
      if (feasibleByTime.get(key)) bundle.forEach((s) => feasible.add(s.crn));
    }

    for (const s of courses[id].sections) {
      if (!checked.has(s.crn) || feasible.has(s.crn) || !s.meetings.length) continue;
      const mine = expand([s]);
      out[s.crn] = others
        .filter((o) => o.opts.every((ms) => ms.some((m) => mine.some((x) => overlaps(m, x)))))
        .map((o) => o.id);
    }
  }
  return out;
}
