# GT Planner

A redesign prototype of the OSCAR Course Registration Planner, styled after gt-scheduler.org.
It adds the planning features OSCAR is missing: automatic section selection driven by your criteria,
banning or forcing sections and professors, and backup schedules for when no schedule meets every rule.

```bash
npm install
npm run dev
```

## Features

- **Scheduler**: add courses, see every conflict-free combination, and flip through them (↑/↓) on a weekly calendar.
- **Auto-Schedule rules**: earliest start, latest end, days off, seat availability, minimum professor GPA, and blocked times.
  Each rule shows how many schedules it rules out.
- **Backup schedules**: when no schedule meets every rule, the planner shows the closest ones and lists which rules they break.
- **Pin / ban / star**: pin a section to force it, ban a section or professor, or star a professor to use only their sections.
- **Linked sections**: lecture + lab/supervised-lab pairing (e.g. ECE 2031, CS 2110, PHYS 2212).
- **Sorting**: best match, highest professor GPA, most compact, earliest ending, latest starting, fewest days.
- **Find Classes**: OSCAR-style search (subject, course number, keyword, plus advanced instructor/attribute) across the full term catalog.
- **Registration Plan**: OSCAR-style plan table with CRNs, status and total hours, plus Copy CRNs for registration.
- **Multiple plans**: Primary plus duplicated backup plans, saved to localStorage. Dark and light themes.

## Data sources

Live data comes from the same public endpoints gt-scheduler.org uses (see `src/lib/api.js`):

| Data | Endpoint |
| --- | --- |
| Terms | `https://gt-scheduler.github.io/crawler-v2/index.json` |
| Courses, sections, meeting times, instructors | `https://gt-scheduler.github.io/crawler-v2/{term}.json` (e.g. `202608`) |
| Professor / course GPAs (Course Critique) | `https://us-east1-gt-scheduler-web-prod.cloudfunctions.net/getCourseDataFromCourseCritique?courseID=CS%201332` |
| Live seats & waitlist (OSCAR) | `https://gt-scheduler.azurewebsites.net/proxy/class_section?term={term}&crn={crn}` |

GPAs are cached in localStorage for 7 days and seat counts in memory for 5 minutes. Requests go through a
4-at-a-time queue, and GPAs and seats are only fetched for courses in your plan or on screen.
