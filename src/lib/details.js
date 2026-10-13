// Course and section details from GT's Banner registration site (the same requests
// OSCAR's "Course Details" / "Class Details" popups make), via the /banner proxy in
// vite.config.js.
import { createQueue } from './api.js';
import { lsGet, lsSet } from './cache.js';

export const DETAIL_TABS = [
  ['getCourseAttributes', 'Attributes'],
  ['getCourseDescription', 'Course Description'],
  ['getSyllabus', 'Syllabus'],
  ['getCourseCatalogDetails', 'Catalog'],
  ['getRestrictions', 'Restrictions'],
  ['getCorequisites', 'Corequisites'],
  ['getPrerequisites', 'Prerequisites'],
  ['getCourseMutuallyExclusions', 'Mutual Exclusion'],
  ['getFees', 'Fees'],
];

// Only what's specific to a section. Tabs that repeat the course popup (description,
// prerequisites, catalog, fees, …) and Linked Sections are intentionally left out.
// Restrictions stays: section restrictions differ from the course's (e.g. FAA sections).
export const SECTION_TABS = [
  ['getClassDetails', 'Class Details'],
  ['getFacultyMeetingTimes', 'Instructor/Meeting Times'],
  ['getEnrollmentInfo', 'Enrollment/Waitlist'],
  ['getRestrictions', 'Restrictions'],
  ['getXlstSections', 'Cross Listed Courses'],
  ['getSectionBookstoreDetails', 'Bookstore Links'],
];

// Live counts go stale fast: never persisted, only reused for a few minutes.
const VOLATILE = new Set(['getEnrollmentInfo']);
const VOLATILE_TTL_MS = 5 * 60 * 1000;

const CACHE_KEY = 'gt-planner-details';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const queue = createQueue(2);
const memory = new Map(); // id -> { at, tabs } for things not persisted

/** Cache entries: { owner: "term|courseId", at, tabs }. Owner decides whether it may persist. */
const courseCacheId = (term, courseId) => `${term}|${courseId}`;
const sectionCacheId = (term, crn) => `${term}|crn:${crn}`;

/** Drop stored details whose course isn't in one of the user's plans (or that expired). */
export function pruneDetailCache(keepOwners) {
  const cache = lsGet(CACHE_KEY, {});
  const now = Date.now();
  const next = Object.fromEntries(
    Object.entries(cache).filter(([, v]) => v.owner && keepOwners.has(v.owner) && now - v.at < TTL_MS)
  );
  if (Object.keys(next).length !== Object.keys(cache).length) lsSet(CACHE_KEY, next);
}

function readCached(id, endpoint) {
  const now = Date.now();
  if (!VOLATILE.has(endpoint)) {
    const hit = lsGet(CACHE_KEY, {})[id];
    if (hit && now - hit.at < TTL_MS && hit.tabs[endpoint] != null) return hit.tabs[endpoint];
  }
  const mem = memory.get(id)?.[endpoint];
  if (mem && (!VOLATILE.has(endpoint) || now - mem.at < VOLATILE_TTL_MS)) return mem.v;
  return undefined;
}

function store(id, owner, endpoint, value, persist) {
  if (persist && !VOLATILE.has(endpoint)) {
    const cache = lsGet(CACHE_KEY, {});
    const entry = cache[id] && Date.now() - cache[id].at < TTL_MS ? cache[id] : { owner, at: Date.now(), tabs: {} };
    entry.tabs[endpoint] = value;
    lsSet(CACHE_KEY, { ...cache, [id]: entry });
  } else {
    memory.set(id, { ...memory.get(id), [endpoint]: { v: value, at: Date.now() } });
  }
}

async function post(path, params) {
  return queue(async () => {
    const res = await fetch(`/banner/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: new URLSearchParams(params),
    });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return res.text();
  });
}

// ---------- course details ----------

export const cachedDetail = (term, courseId, endpoint) => readCached(courseCacheId(term, courseId), endpoint);

export async function fetchDetail(term, courseId, endpoint, persist) {
  const id = courseCacheId(term, courseId);
  const cached = readCached(id, endpoint);
  if (cached != null) return cached;
  const [subjectCode, courseNumber] = courseId.split(' ');
  const html = sanitize(await post(`courseSearchResults/${endpoint}`, { term, subjectCode, courseNumber, first: 'first' }));
  store(id, id, endpoint, html, persist);
  return html;
}

// ---------- section details ----------

export const cachedSectionDetail = (term, crn, endpoint) => readCached(sectionCacheId(term, crn), endpoint);

/** Returns sanitized HTML, or for getFacultyMeetingTimes the parsed meeting/faculty data. */
export async function fetchSectionDetail(term, section, endpoint, persist) {
  const id = sectionCacheId(term, section.crn);
  const cached = readCached(id, endpoint);
  if (cached != null) return cached;

  let value;
  if (endpoint === 'getFacultyMeetingTimes') {
    const res = await queue(() =>
      fetch(`/banner/searchResults/getFacultyMeetingTimes?term=${term}&courseReferenceNumber=${section.crn}`)
    );
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    value = simplifyMeetings(await res.json());
  } else {
    value = sanitize(await post(`searchResults/${endpoint}`, { term, courseReferenceNumber: section.crn }));
  }
  store(id, courseCacheId(term, section.courseId), endpoint, value, persist);
  return value;
}

const DAY_KEYS = [
  ['monday', 'M'],
  ['tuesday', 'T'],
  ['wednesday', 'W'],
  ['thursday', 'R'],
  ['friday', 'F'],
  ['saturday', 'S'],
  ['sunday', 'U'],
];

function simplifyMeetings(json) {
  const out = { faculty: [], meetings: [] };
  for (const f of json.fmt || []) {
    for (const p of f.faculty || [])
      if (!out.faculty.some((x) => x.name === p.displayName))
        out.faculty.push({ name: p.displayName, email: p.emailAddress, primary: !!p.primaryIndicator });
    const m = f.meetingTime;
    if (m)
      out.meetings.push({
        type: m.meetingTypeDescription,
        days: DAY_KEYS.filter(([k]) => m[k]).map(([, d]) => d).join(''),
        begin: m.beginTime,
        end: m.endTime,
        where: [m.buildingDescription, m.room].filter(Boolean).join(' '),
        campus: m.campusDescription,
        dates: m.startDate && m.endDate ? `${m.startDate} – ${m.endDate}` : '',
        hoursWeek: m.hoursWeek,
      });
  }
  return out;
}

// ---------- sanitizing Banner's HTML fragments ----------

const ALLOWED = new Set([
  'SECTION', 'DIV', 'SPAN', 'P', 'BR', 'B', 'STRONG', 'I', 'EM', 'UL', 'OL', 'LI',
  'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'A',
]);
const KEEP_CLASSES = new Set(['status-bold', 'indent-left', 'detail-popup-indentation', 'credit-hours-direction']);

/** Whitelist-based cleanup: unknown tags are unwrapped, all attributes except safe ones are removed. */
export function sanitize(html) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstChild;
  root
    .querySelectorAll('.notvisible, [style*="display:none"], [style*="display: none"], script, style, iframe, object, embed, form, input, button')
    .forEach((n) => n.remove());

  const walk = (el) => {
    for (const child of [...el.children]) {
      walk(child);
      if (!ALLOWED.has(child.tagName)) {
        child.replaceWith(...child.childNodes);
        continue;
      }
      const href = child.tagName === 'A' ? child.getAttribute('href') : null;
      const classes = [...child.classList].filter((c) => KEEP_CLASSES.has(c));
      for (const attr of [...child.attributes]) child.removeAttribute(attr.name);
      if (classes.length) child.className = classes.join(' ');
      if (href && /^https?:\/\//i.test(href)) {
        child.setAttribute('href', href);
        child.setAttribute('target', '_blank');
        child.setAttribute('rel', 'noopener noreferrer');
      }
    }
  };
  walk(root);
  return root.innerHTML.trim();
}

// ---------- subject names (for the Find Classes subject combobox) ----------

const SUBJECTS_KEY = 'gt-planner-subjects';

/** { CS: 'Computer Science', ... } for a term; cached in localStorage. */
export function cachedSubjects(term) {
  return lsGet(SUBJECTS_KEY, {})[term] || null;
}

export async function fetchSubjects(term) {
  const cached = cachedSubjects(term);
  if (cached) return cached;
  const res = await fetch(`/banner/classSearch/get_subject?searchTerm=&term=${term}&offset=1&max=500`);
  if (!res.ok) throw new Error(`Subject request failed (${res.status})`);
  const txt = document.createElement('textarea');
  const names = Object.fromEntries(
    (await res.json()).map(({ code, description }) => {
      txt.innerHTML = description;
      return [code, txt.value];
    })
  );
  lsSet(SUBJECTS_KEY, { ...lsGet(SUBJECTS_KEY, {}), [term]: names });
  return names;
}
