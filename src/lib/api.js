// The same public endpoints gt-scheduler.org uses:
//   course catalog  – crawler-v2 JSON on GitHub Pages (one file per term)
//   professor GPAs  – Course Critique, proxied through a GT Scheduler cloud function
//   live seats      – OSCAR class_section page, proxied through the GT Scheduler backend
const CRAWLER_BASE_URL = 'https://gt-scheduler.github.io/crawler-v2';
const COURSE_CRITIQUE_URL = 'https://us-east1-gt-scheduler-web-prod.cloudfunctions.net/getCourseDataFromCourseCritique';
const BACKEND_BASE_URL = 'https://gt-scheduler.azurewebsites.net';

const GPA_CACHE_KEY = 'gt-planner-gpa-cache-v2'; // v2 adds Course Critique instructor ids
const GPA_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SEAT_TTL_MS = 5 * 60 * 1000;

const SEASONS = { '02': 'Spring', '05': 'Summer', '08': 'Fall' };
export const termLabel = (term) => `${SEASONS[term.slice(4)] || term.slice(4)} ${term.slice(0, 4)}`;

export async function fetchTerms() {
  const res = await fetch(`${CRAWLER_BASE_URL}/index.json`);
  if (!res.ok) throw new Error(`Term list request failed (${res.status})`);
  const { terms } = await res.json();
  return terms.map((t) => t.term);
}

// ---------- catalog ----------

const decodeEl = typeof document !== 'undefined' ? document.createElement('textarea') : null;
function decode(s) {
  if (!s || !s.includes('&') || !decodeEl) return s;
  decodeEl.innerHTML = s;
  return decodeEl.value;
}

function parsePeriod(p) {
  const m = /^(\d{2})(\d{2}) - (\d{2})(\d{2})$/.exec(p || '');
  if (!m) return null;
  return { start: +m[1] * 60 + +m[2], end: +m[3] * 60 + +m[4] };
}

const isLab = (type) => type.includes('Lab') || type.includes('Studio');
const isLecture = (type) => type.includes('Lecture');

/** Lecture/lab pairing, ported from gt-scheduler's Course bean. */
function linkLabs(course) {
  const lectures = course.sections.filter((s) => isLecture(s.type) && !isLab(s.type));
  const labs = course.sections.filter((s) => isLab(s.type) && !isLecture(s.type));
  course.hasLab = lectures.length > 0 && labs.length > 0;
  if (!course.hasLab) {
    course.leads = course.sections;
    course.labs = [];
    return;
  }
  const conflict = (a, b) =>
    a.meetings.some((m) =>
      b.meetings.some((n) => [...m.days].some((d) => n.days.includes(d)) && m.start < n.end && n.start < m.end)
    );
  const byId = (lab, lec) => lec.section.startsWith(lab.section) || lab.section.startsWith(lec.section);
  const byProf = (lab, lec) => lab.instructors.some((i) => lec.instructors.includes(i));

  for (const lec of lectures) {
    let assoc = labs.filter((lab) => byId(lab, lec));
    if (!assoc.length) assoc = labs.filter((lab) => byProf(lab, lec) && !conflict(lab, lec));
    lec.labCrns = assoc.map((l) => l.crn);
  }
  const linked = new Set(lectures.flatMap((l) => l.labCrns));
  const lonelyLabs = labs.filter((l) => !linked.has(l.crn));
  for (const lec of lectures.filter((l) => !l.labCrns.length)) {
    lec.labCrns = lonelyLabs.filter((lab) => !conflict(lec, lab)).map((l) => l.crn);
  }
  const allInOnes = course.sections.filter((s) => isLecture(s.type) && isLab(s.type));
  course.leads = [...lectures, ...allInOnes];
  course.labs = labs;
}

/** Raw crawler JSON for a term (what gets cached in IndexedDB). */
export async function fetchTermRaw(term) {
  const res = await fetch(`${CRAWLER_BASE_URL}/${term}.json`);
  if (!res.ok) throw new Error(`Course data request failed (${res.status})`);
  return res.json();
}

export function parseTermData(data) {
  const { caches } = data;
  const periods = caches.periods.map(parsePeriod);
  const types = caches.scheduleTypes.map((t) => decode(t).replace(/\*$/, ''));
  const campuses = caches.campuses.map((c) => decode(c).replace(/\s*\*$/, ''));
  const attributes = caches.attributes.map(decode);

  const courses = {};
  const byCrn = {};
  for (const [id, [title, sections, prereqs, description]] of Object.entries(data.courses)) {
    const [subject, number] = id.split(' ');
    const course = {
      id,
      subject,
      number,
      title: decode(title),
      description: decode(description) || '',
      prereqs,
      sections: [],
    };
    for (const [code, s] of Object.entries(sections)) {
      const [crn, meetings, hours, typeIdx, campusIdx, attrIdx] = s;
      const instructors = [];
      let primary = null;
      for (const m of meetings)
        for (const raw of m[4]) {
          const name = raw.replace(/\s*\(P\)$/, '');
          if (raw.endsWith('(P)') && !primary) primary = name;
          if (!instructors.includes(name)) instructors.push(name);
        }
      const section = {
        crn,
        section: code,
        courseId: id,
        type: types[typeIdx] || 'Other',
        hours,
        campus: campuses[campusIdx] || '',
        attributes: (attrIdx || []).map((i) => attributes[i]),
        instructors,
        instructor: primary || instructors[0] || 'TBA',
        meetings: meetings
          .map((m) => {
            const p = periods[m[0]];
            return p && m[1] ? { days: m[1], start: p.start, end: p.end, location: decode(m[2]) } : null;
          })
          .filter(Boolean),
        labCrns: [],
      };
      course.sections.push(section);
      byCrn[crn] = section;
    }
    linkLabs(course);
    course.hours = Math.max(0, ...course.leads.map((s) => s.hours));
    course.attributes = [...new Set(course.sections.flatMap((s) => s.attributes))];
    courses[id] = course;
  }
  return {
    courses,
    byCrn,
    attributes: [...new Set(attributes)].sort(),
    campuses: [...new Set(campuses)],
    updatedAt: data.updatedAt,
  };
}

// ---------- GPA (Course Critique) ----------

/** Course Critique has no per-letter variants, so "CS 1301R" shares "CS 1301"'s data. */
export const gpaKey = (courseId) => courseId.replace(/^(\S+) (\S+)$/, (_, s, n) => `${s} ${n.replace(/\D/g, '')}`);

/** Every unexpired cached GPA entry, for synchronous hydration on startup. */
export function cachedGpas() {
  const now = Date.now();
  return Object.fromEntries(
    Object.entries(readGpaCache())
      .filter(([, v]) => now < v.exp)
      .map(([k, v]) => [k, v.d])
  );
}

function readGpaCache() {
  try {
    return JSON.parse(localStorage.getItem(GPA_CACHE_KEY)) || {};
  } catch {
    return {};
  }
}

const CLASS_SIZE_WEIGHT = {
  'very small (fewer than 10 students)': 5,
  'small (10-20 students)': 15,
  'mid-size (21-30 students)': 25,
  'large (31-49 students)': 40,
  'very large (50 students or more)': 50,
};

/** Same weighting gt-scheduler applies to Course Critique rows. */
function decodeCritique(body) {
  const total = { count: 0, sum: 0 };
  const byProf = {};
  const ids = {};
  for (const row of body.raw || []) {
    const w = CLASS_SIZE_WEIGHT[String(row.class_size_group).toLowerCase()];
    if (!w || typeof row.GPA !== 'number' || typeof row.instructor_name !== 'string') continue;
    let name = decode(row.instructor_name);
    const parts = name.split(', ');
    if (parts.length === 2) name = `${parts[1]} ${parts[0]}`;
    if (row.instructor_id) ids[name] = row.instructor_id;
    total.count += w;
    total.sum += row.GPA * w;
    const p = (byProf[name] ||= { count: 0, sum: 0 });
    p.count += w;
    p.sum += row.GPA * w;
  }
  return {
    course: total.count ? total.sum / total.count : null,
    instructors: Object.fromEntries(Object.entries(byProf).map(([n, v]) => [n, v.sum / v.count])),
    ids,
  };
}

export async function fetchGpa(courseId) {
  const id = gpaKey(courseId);
  const cache = readGpaCache();
  const hit = cache[id];
  if (hit && Date.now() < hit.exp) return hit.d;

  const res = await fetch(`${COURSE_CRITIQUE_URL}?courseID=${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`GPA request failed (${res.status})`);
  const d = decodeCritique(await res.json());
  try {
    const fresh = readGpaCache();
    fresh[id] = { d, exp: Date.now() + GPA_TTL_MS };
    localStorage.setItem(GPA_CACHE_KEY, JSON.stringify(fresh));
  } catch {
    /* storage full or unavailable */
  }
  return d;
}

/** Instructor GPA lookup tolerant of middle names / initials differing between OSCAR and Course Critique. */
function matchInstructor(gpa, name) {
  if (!gpa || !name) return null;
  if (gpa.instructors[name] != null) return name;
  const parts = name.toLowerCase().split(/\s+/);
  const first = parts[0];
  const last = parts[parts.length - 1];
  for (const n of Object.keys(gpa.instructors)) {
    const p = n.toLowerCase().split(/\s+/);
    if (p[p.length - 1] === last && p[0][0] === first[0]) return n;
  }
  return null;
}

export function lookupInstructorGpa(gpa, name) {
  const key = matchInstructor(gpa, name);
  return key ? gpa.instructors[key] : null;
}

/** Course Critique's instructor id (used in critique.gatech.edu/prof?profID=…), if known. */
export function lookupInstructorId(gpa, name) {
  const key = matchInstructor(gpa, name);
  return key ? gpa.ids?.[key] ?? null : null;
}

// ---------- seats (OSCAR via GT Scheduler proxy) ----------

export async function fetchSeats(term, crn) {
  const res = await fetch(`${BACKEND_BASE_URL}/proxy/class_section?term=${term}&crn=${crn}`, {
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  });
  if (!res.ok) throw new Error(`Seat request failed (${res.status})`);
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
  const vals = [...doc.querySelectorAll('span:not(.status-bold)')].map((s) => parseInt(s.textContent, 10));
  // Order: enrollment actual, max, available, waitlist capacity, actual, available
  const [filled, cap, , wlCap, wlFilled] = vals;
  if ([filled, cap].some((v) => Number.isNaN(v))) throw new Error('Unexpected seat response');
  return { filled, cap, wlCap: wlCap || 0, wlFilled: wlFilled || 0, at: Date.now() };
}

/** Small promise pool so we never hammer the shared GT Scheduler services. */
export function createQueue(concurrency) {
  let active = 0;
  const waiting = [];
  const next = () => {
    if (active >= concurrency || !waiting.length) return;
    active++;
    const { fn, resolve, reject } = waiting.shift();
    fn()
      .then(resolve, reject)
      .finally(() => {
        active--;
        next();
      });
  };
  return (fn) =>
    new Promise((resolve, reject) => {
      waiting.push({ fn, resolve, reject });
      next();
    });
}
