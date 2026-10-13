export const DAYS = ['M', 'T', 'W', 'R', 'F'];
export const DAY_NAMES = { M: 'Monday', T: 'Tuesday', W: 'Wednesday', R: 'Thursday', F: 'Friday' };

export function fmtTime(min, withMeridiem = true) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const h12 = ((h + 11) % 12) + 1;
  const suffix = withMeridiem ? (h < 12 ? ' am' : ' pm') : '';
  return `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

export function fmtRange(start, end) {
  const sameHalf = start < 720 === end < 720;
  return `${fmtTime(start, !sameHalf)} - ${fmtTime(end)}`;
}

export function fmtHour(h) {
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}${h < 12 ? 'am' : 'pm'}`;
}

export function toInput(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

export function fromInput(s) {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function daysOf(str) {
  return str.split('').filter((d) => DAYS.includes(d));
}
