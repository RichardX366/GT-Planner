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
- **Find Classes**: OSCAR-style search (subject, course number, keyword, plus advanced instructor/attribute/open seats).
- **Registration Plan**: OSCAR-style plan table with CRNs, status and total hours, plus Copy CRNs for registration.
- **Multiple plans**: Primary plus duplicated backup plans, saved to localStorage. Dark and light themes.

Course data in `src/data/catalog.js` is **sample data**. Instructor names, GPAs and seat counts are made up.
