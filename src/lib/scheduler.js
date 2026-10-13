import { COURSES } from '../data/catalog.js';
import { DAYS, daysOf, fmtTime } from './time.js';

const MAX_COMBOS = 25000;
const SHOW_LIMIT = 60;

export const SORTS = {
  best: 'Best Match',
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

export function seatStatus(s) {
  if (s.seats.filled < s.seats.cap) return { kind: 'open', label: `${s.seats.cap - s.seats.filled} of ${s.seats.cap} seats` };
  if (s.waitlist.cap > s.waitlist.filled) return { kind: 'waitlist', label: `Full · ${s.waitlist.cap - s.waitlist.filled} of ${s.waitlist.cap} waitlist` };
  return { kind: 'full', label: 'Full · waitlist closed' };
}

export function instructorGpa(course, name) {
  return course.instructors[name] ?? null;
}

/** All valid section bundles (primary section + one of each linked component) for a course. */
export function courseBundles(course, plan) {
  const excluded = new Set(plan.excluded);
  const pinned = new Set(plan.pinned);
  const banned = plan.bannedInstructors[course.id] || [];
  const forced = plan.forcedInstructors[course.id] || [];

  const byType = {};
  for (const type of [course.primaryType, ...course.componentTypes]) {
    let list = course.sections.filter((s) => s.type === type && !excluded.has(s.crn));
    if (type === course.primaryType) {
      list = list.filter((s) => !banned.includes(s.instructor));
      if (forced.length) list = list.filter((s) => forced.includes(s.instructor));
    }
    const pins = list.filter((s) => pinned.has(s.crn));
    byType[type] = pins.length ? pins : list;
  }

  const bundles = [];
  for (const lead of byType[course.primaryType]) {
    let partial = [[lead]];
    for (const type of course.componentTypes) {
      const options = byType[type].filter((s) => s.link == null || lead.link == null || s.link === lead.link);
      partial = partial.flatMap((b) => options.map((o) => [...b, o]));
    }
    bundles.push(...partial);
  }
  return bundles;
}

function expand(sections) {
  const out = [];
  for (const s of sections)
    for (const m of s.meetings)
      for (const d of daysOf(m.days)) out.push({ day: d, start: m.start, end: m.end, crn: s.crn });
  return out;
}

const overlaps = (a, b) => a.day === b.day && a.start < b.end && b.start < a.end;

function evaluate(sections, criteria) {
  const meetings = expand(sections);
  const byDay = Object.fromEntries(DAYS.map((d) => [d, []]));
  meetings.forEach((m) => byDay[m.day].push(m));

  let gaps = 0;
  let starts = 0;
  let ends = 0;
  let used = 0;
  let earliest = Infinity;
  let latest = 0;
  for (const d of DAYS) {
    const list = byDay[d].sort((a, b) => a.start - b.start);
    if (!list.length) continue;
    used++;
    starts += list[0].start;
    ends += list[list.length - 1].end;
    earliest = Math.min(earliest, list[0].start);
    latest = Math.max(latest, list[list.length - 1].end);
    for (let i = 1; i < list.length; i++) gaps += Math.max(0, list[i].start - list[i - 1].end);
  }

  // Credit-hour weighted instructor GPA for the lead (lecture) section of each course.
  let gpaSum = 0;
  let gpaHours = 0;
  const leads = sections.filter((s) => COURSES[s.courseId].primaryType === s.type);
  for (const s of leads) {
    const c = COURSES[s.courseId];
    const g = instructorGpa(c, s.instructor);
    if (g != null) {
      const w = Math.max(c.hours, 1);
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
      const k = seatStatus(s).kind;
      return c.seats.mode === 'open' ? k !== 'open' : k === 'full';
    });
    if (bad.length) violations.push({ key: 'seats', text: `${bad.length} full section${bad.length > 1 ? 's' : ''}` });
  }
  if (c.minGpa.on) {
    const low = leads.filter((s) => {
      const g = instructorGpa(COURSES[s.courseId], s.instructor);
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
    gpa,
    gaps,
    days: used,
    avgStart: used ? starts / used : 0,
    avgEnd: used ? ends / used : 0,
    earliest: used ? earliest : 0,
    latest,
    violations,
  };
}

const comparators = {
  gpa: (a, b) => (b.gpa ?? 0) - (a.gpa ?? 0) || a.gaps - b.gaps,
  compact: (a, b) => a.gaps - b.gaps || a.days - b.days || (b.gpa ?? 0) - (a.gpa ?? 0),
  earliestEnd: (a, b) => a.avgEnd - b.avgEnd || a.gaps - b.gaps,
  latestStart: (a, b) => b.avgStart - a.avgStart || a.gaps - b.gaps,
  fewestDays: (a, b) => a.days - b.days || a.gaps - b.gaps,
  best: (a, b) => score(b) - score(a),
};

function score(c) {
  // Professor quality dominates; compactness and fewer days break ties.
  return (c.gpa ?? 2.5) * 10 - c.gaps / 60 - c.days * 0.4;
}

export function generateSchedules(courseIds, plan) {
  const perCourse = courseIds
    .filter((id) => COURSES[id])
    .map((id) => ({ id, bundles: courseBundles(COURSES[id], plan) }));
  const emptyCourses = perCourse.filter((p) => !p.bundles.length).map((p) => p.id);
  if (!perCourse.length || emptyCourses.length)
    return { matches: [], backups: [], total: 0, truncated: false, emptyCourses, impact: {} };

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
      results.push(evaluate(chosen.flat(), plan.criteria));
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

  const cmp = comparators[plan.sortBy] || comparators.best;
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

/** Section bundles conflicting check for a single course (used for the "N options" badge). */
export function optionCount(course, plan) {
  return courseBundles(course, plan).length;
}
