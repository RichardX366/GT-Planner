import { DAYS, daysOf, fmtTime } from './time.js';

const MAX_COMBOS = 25000;
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
    const g = ctx.instructorGpa(s.courseId, s.instructor);
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

/**
 * Bundles with identical meeting times and the same professors are interchangeable for
 * scheduling, so keep only the one with the best seat availability (big courses like
 * LMC 3403 have dozens of such sections).
 */
function dedupe(bundles, seats) {
  const best = new Map();
  for (const b of bundles) {
    const key = b.map((s) => `${s.instructor}|${s.meetings.map((m) => `${m.days}${m.start}-${m.end}`).join(',')}`).join('#');
    const rank = Math.max(...b.map((s) => SEAT_RANK[seatStatus(seats[s.crn]).kind]));
    const cur = best.get(key);
    if (!cur || rank < cur.rank) best.set(key, { b, rank });
  }
  return [...best.values()].map((v) => v.b);
}

/** ctx: { courses, seats, instructorGpa } */
export function generateSchedules(courseIds, plan, ctx) {
  const perCourse = courseIds
    .filter((id) => ctx.courses[id])
    .map((id) => ({ id, bundles: dedupe(courseBundles(ctx.courses[id], plan), ctx.seats) }));
  const emptyCourses = perCourse.filter((p) => !p.bundles.length).map((p) => p.id);
  const blank = { matches: [], backups: [], matchCount: 0, backupCount: 0, total: 0, truncated: false, emptyCourses, impact: {} };
  if (!perCourse.length || emptyCourses.length) return blank;

  perCourse.sort((a, b) => a.bundles.length - b.bundles.length);
  const bundleMeetings = new Map();
  perCourse.forEach((p) => p.bundles.forEach((b) => bundleMeetings.set(b, expand(b))));

  const results = [];
  let truncated = false;
  const chosen = [];
  const busy = [];
  (function dfs(i) {
    if (results.length >= MAX_COMBOS) {
      truncated = true;
      return;
    }
    if (i === perCourse.length) {
      results.push(evaluate(chosen.flat(), plan.criteria, ctx));
      return;
    }
    for (const bundle of perCourse[i].bundles) {
      const ms = bundleMeetings.get(bundle);
      if (ms.some((m) => busy.some((b) => overlaps(m, b)))) continue;
      chosen.push(bundle);
      busy.push(...ms);
      dfs(i + 1);
      busy.length -= ms.length;
      chosen.pop();
    }
  })(0);

  const cmp = comparators[plan.sortBy] || comparators.gpa;
  const matches = results.filter((r) => !r.violations.length).sort(cmp);
  const backups = results
    .filter((r) => r.violations.length)
    .sort((a, b) => a.violations.length - b.violations.length || cmp(a, b));

  const impact = {};
  results.forEach((r) => r.violations.forEach((v) => (impact[v.key] = (impact[v.key] || 0) + 1)));

  return {
    matches: matches.slice(0, SHOW_LIMIT),
    backups: backups.slice(0, SHOW_LIMIT),
    matchCount: matches.length,
    backupCount: backups.length,
    total: results.length,
    truncated,
    emptyCourses,
    impact,
  };
}

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
