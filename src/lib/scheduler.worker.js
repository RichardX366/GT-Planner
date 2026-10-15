// Runs schedule generation off the main thread so the UI never stalls or blanks
// while the combination list is recomputed.
import { findConflicts, generateSchedules, serializeResult } from './scheduler.js';
import { gpaKey, lookupInstructorGpa } from './api.js';

self.onmessage = ({ data }) => {
  const { id, courseIds, plan, courses, seats, gpa } = data;
  const instructorGpa = (courseId, name) => lookupInstructorGpa(gpa[gpaKey(courseId)], name);
  const courseGpa = (courseId) => gpa[gpaKey(courseId)]?.course ?? null;
  const result = generateSchedules(courseIds, plan, { courses, seats, instructorGpa, courseGpa });
  const conflicts = findConflicts(courseIds, plan, courses);
  self.postMessage({ id, result: { ...serializeResult(result), conflicts } });
};
