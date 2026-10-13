// Mock Fall 2026 catalog. Instructor names, GPAs, rooms and seat counts are
// sample data for the prototype, not real OSCAR / Course Critique records.

export const TERM = 'Fall 2026';

const t = (s) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};

// sec(crn, section, type, instructor, days, start, end, location, [cap, filled], [wlCap, wlFilled], link)
function sec(crn, section, type, instructor, days, start, end, location, seats, waitlist = [0, 0], link = null) {
  return {
    crn,
    section,
    type,
    instructor,
    meetings: days ? [{ days, start: t(start), end: t(end), location }] : [],
    seats: { cap: seats[0], filled: seats[1] },
    waitlist: { cap: waitlist[0], filled: waitlist[1] },
    link,
  };
}

const RAW = [
  {
    subject: 'CS', number: '1332', title: 'Data Struct & Algorithms', hours: 3,
    description: 'Computer data structures and algorithms in the context of object-oriented programming. Focus on software development and analysis of algorithms.',
    attributes: ['STEM USG', 'No-cost req\'d textbooks'],
    instructors: { 'Dana Whitfield': 3.07, 'Marcus Bell': 2.96, 'Priya Raman': 3.24 },
    sections: [
      sec('81205', 'A', 'Lecture', 'Dana Whitfield', 'TR', '12:30', '13:45', 'Klaus 1443', [173, 170], [50, 0]),
      sec('83118', 'B', 'Lecture', 'Dana Whitfield', 'TR', '15:30', '16:45', 'Klaus 1443', [173, 173], [50, 31]),
      sec('83119', 'C', 'Lecture', 'Marcus Bell', 'MWF', '9:00', '9:50', 'Howey L1', [200, 182], [50, 0]),
      sec('83120', 'D', 'Lecture', 'Marcus Bell', 'MWF', '14:00', '14:50', 'Howey L1', [200, 200], [50, 50]),
      sec('83121', 'E', 'Lecture', 'Priya Raman', 'TR', '9:30', '10:45', 'CULC 152', [150, 141], [40, 0]),
    ],
  },
  {
    subject: 'CS', number: '2110', title: 'Computer Organiz&Program', hours: 4,
    description: 'An introduction to basic computer hardware, machine language, assembly language, and C programming.',
    attributes: ['STEM USG'],
    instructors: { 'Leah Okafor': 2.84, 'Ethan Brandt': 3.02 },
    sections: [
      sec('80410', 'A', 'Lecture', 'Leah Okafor', 'MW', '11:00', '12:15', 'CULC 144', [250, 231], [50, 0], 'A'),
      sec('80411', 'B', 'Lecture', 'Ethan Brandt', 'TR', '14:00', '15:15', 'CULC 144', [250, 249], [50, 0], 'B'),
      sec('80412', 'A01', 'Lab', 'TA Staff', 'F', '9:00', '10:50', 'Klaus 2443', [40, 38], [10, 0], 'A'),
      sec('80413', 'A02', 'Lab', 'TA Staff', 'F', '11:00', '12:50', 'Klaus 2443', [40, 40], [10, 4], 'A'),
      sec('80414', 'A03', 'Lab', 'TA Staff', 'R', '16:30', '18:20', 'Klaus 2443', [40, 22], [10, 0], 'A'),
      sec('80415', 'B01', 'Lab', 'TA Staff', 'W', '15:00', '16:50', 'Klaus 2448', [40, 35], [10, 0], 'B'),
      sec('80416', 'B02', 'Lab', 'TA Staff', 'F', '13:00', '14:50', 'Klaus 2448', [40, 19], [10, 0], 'B'),
    ],
  },
  {
    subject: 'CS', number: '2200', title: 'Systems and Networks', hours: 4,
    description: 'A variety of software and hardware systems issues: processor design, memory hierarchy, operating systems, and networking.',
    attributes: ['STEM USG'],
    instructors: { 'Kiran Desai': 2.71, 'Ruth Lindqvist': 2.93 },
    sections: [
      sec('80166', 'A', 'Lecture', 'Kiran Desai', 'MWF', '10:00', '10:50', 'Boggs B9', [180, 176], [30, 0]),
      sec('80167', 'B', 'Lecture', 'Ruth Lindqvist', 'TR', '11:00', '12:15', 'Clough 144', [180, 180], [30, 12]),
      sec('80168', 'C', 'Lecture', 'Ruth Lindqvist', 'TR', '17:00', '18:15', 'Clough 152', [160, 98], [30, 0]),
    ],
  },
  {
    subject: 'CS', number: '2340', title: 'Objects and Design', hours: 3,
    description: 'Object-oriented programming methods for dealing with large programs. Focus on quality processes, effective debugging, and team projects.',
    attributes: ['STEM USG', 'Tech Elect CS, Engr, &Sciences'],
    instructors: { 'Hannah Choi': 3.48, 'Victor Mensah': 3.31 },
    sections: [
      sec('82001', 'A', 'Lecture', 'Hannah Choi', 'MW', '15:30', '16:45', 'CCB 16', [120, 97], [20, 0]),
      sec('82002', 'B', 'Lecture', 'Victor Mensah', 'TR', '8:00', '9:15', 'CCB 16', [120, 66], [20, 0]),
      sec('82003', 'C', 'Lecture', 'Victor Mensah', 'TR', '12:30', '13:45', 'Van Leer C341', [120, 120], [20, 20]),
    ],
  },
  {
    subject: 'CS', number: '3510', title: 'Dsgn&Analysis-Algorithms', hours: 3,
    description: 'Basic techniques of design and analysis of efficient algorithms for standard computational problems. NP-completeness.',
    attributes: ['STEM USG'],
    instructors: { 'Samuel Ortiz': 2.65, 'Mei Tanaka': 2.88 },
    sections: [
      sec('84010', 'A', 'Lecture', 'Samuel Ortiz', 'TR', '9:30', '10:45', 'Klaus 1456', [150, 133], [30, 0]),
      sec('84011', 'B', 'Lecture', 'Mei Tanaka', 'MW', '12:30', '13:45', 'Klaus 1456', [150, 150], [30, 9]),
      sec('84012', 'C', 'Lecture', 'Mei Tanaka', 'MW', '17:00', '18:15', 'Klaus 1456', [150, 101], [30, 0]),
    ],
  },
  {
    subject: 'CS', number: '3600', title: 'Intro-Artificial Intell', hours: 3,
    description: 'Introduction to AI: search, knowledge representation, planning, probabilistic reasoning, and machine learning.',
    attributes: ['STEM USG', 'Tech Elect CS, Engr, &Sciences'],
    instructors: { 'Noah Albright': 3.36, 'Isabel Ferreira': 3.12 },
    sections: [
      sec('85500', 'A', 'Lecture', 'Noah Albright', 'MW', '9:30', '10:45', 'Instr Center 213', [200, 188], [30, 0]),
      sec('85501', 'B', 'Lecture', 'Isabel Ferreira', 'TR', '14:00', '15:15', 'Instr Center 213', [200, 164], [30, 0]),
    ],
  },
  {
    subject: 'ECE', number: '2031', title: 'Digital Design Lab', hours: 2,
    description: 'Design, build and test digital systems using programmable logic; introduction to assembly-level programming.',
    attributes: ['STEM USG', 'Tech Elect CS, Engr, &Sciences'],
    instructors: { 'Thomas Carlisle': 3.41, 'Kevin Jansen': 3.38 },
    sections: [
      sec('80351', 'A', 'Lecture', 'Thomas Carlisle', 'M', '14:00', '14:50', 'Van Leer C240', [240, 240], [60, 37]),
      sec('83434', 'B', 'Lecture', 'Kevin Jansen', 'M', '17:00', '17:50', 'Van Leer C240', [240, 240], [60, 31]),
      sec('80780', 'L01', 'Supervised Lab', 'TA Staff', 'T', '8:00', '10:45', 'Van Leer E283', [18, 18]),
      sec('80781', 'L02', 'Supervised Lab', 'TA Staff', 'T', '15:30', '18:15', 'Van Leer E283', [18, 17]),
      sec('80782', 'L03', 'Supervised Lab', 'TA Staff', 'W', '8:00', '10:45', 'Van Leer E283', [18, 18]),
      sec('80783', 'L04', 'Supervised Lab', 'TA Staff', 'W', '12:30', '15:15', 'Van Leer E283', [18, 12]),
      sec('80784', 'L09', 'Supervised Lab', 'TA Staff', 'R', '15:30', '18:15', 'Van Leer E283', [18, 18]),
      sec('83439', 'L10', 'Supervised Lab', 'TA Staff', 'F', '9:00', '11:45', 'Van Leer E283', [18, 15]),
    ],
  },
  {
    subject: 'LMC', number: '3403', title: 'Technical Communication', hours: 3,
    description: 'Principles and practices of effective written, oral, and visual communication in technical and professional settings.',
    attributes: ['Humanities', 'Ethics'],
    instructors: { 'Avery Sinclair': 3.62, 'Jordan Pike': 3.55, 'Rosa Delgado': 3.71 },
    sections: [
      sec('83729', 'H1', 'Lecture', 'Avery Sinclair', 'TR', '9:30', '10:45', 'Skiles 368', [25, 24]),
      sec('83730', 'H2', 'Lecture', 'Avery Sinclair', 'TR', '11:00', '12:15', 'Skiles 368', [25, 25], [5, 2]),
      sec('83731', 'J1', 'Lecture', 'Jordan Pike', 'MWF', '11:00', '11:50', 'Skiles 371', [25, 19]),
      sec('83732', 'J2', 'Lecture', 'Jordan Pike', 'MWF', '13:00', '13:50', 'Skiles 371', [25, 25], [5, 5]),
      sec('83733', 'R1', 'Lecture', 'Rosa Delgado', 'MW', '15:30', '16:45', 'Skiles 302', [25, 20]),
    ],
  },
  {
    subject: 'MATH', number: '3012', title: 'Applied Combinatorics', hours: 3,
    description: 'Elementary combinatorial techniques used in discrete problem solving: counting methods, graph theory, recurrences.',
    attributes: ['STEM USG'],
    instructors: { 'Gregory Hale': 2.79, 'Anika Bose': 3.05 },
    sections: [
      sec('86100', 'A', 'Lecture', 'Gregory Hale', 'MWF', '8:00', '8:50', 'Skiles 249', [45, 40]),
      sec('86101', 'B', 'Lecture', 'Anika Bose', 'MWF', '12:00', '12:50', 'Skiles 249', [45, 45], [10, 3]),
      sec('86102', 'C', 'Lecture', 'Anika Bose', 'TR', '14:00', '15:15', 'Skiles 255', [45, 30]),
      sec('86103', 'D', 'Lecture', 'Gregory Hale', 'TR', '17:00', '18:15', 'Skiles 255', [45, 12]),
    ],
  },
  {
    subject: 'MATH', number: '3215', title: 'Intro Probability&Statistics', hours: 3,
    description: 'Probability spaces, random variables, expectation, limit theorems, estimation, and hypothesis testing.',
    attributes: ['STEM USG'],
    instructors: { 'Oliver Marsh': 2.58, 'Lin Zhao': 2.97 },
    sections: [
      sec('86300', 'A', 'Lecture', 'Oliver Marsh', 'MWF', '10:00', '10:50', 'Skiles 254', [45, 44]),
      sec('86301', 'B', 'Lecture', 'Lin Zhao', 'TR', '11:00', '12:15', 'Skiles 254', [45, 39]),
      sec('86302', 'C', 'Lecture', 'Lin Zhao', 'TR', '15:30', '16:45', 'Skiles 268', [45, 45], [10, 6]),
    ],
  },
  {
    subject: 'PHYS', number: '2212', title: 'Intro Physics II', hours: 4,
    description: 'Electrostatics, electric circuits, magnetostatics, electromagnetic induction, and electromagnetic waves.',
    attributes: ['STEM USG', 'Lab Science'],
    instructors: { 'Elena Petrova': 2.63, 'Caleb Wright': 2.81 },
    sections: [
      sec('87000', 'A', 'Lecture', 'Elena Petrova', 'MWF', '9:00', '9:50', 'Howey L2', [240, 230], [40, 0], 'A'),
      sec('87001', 'B', 'Lecture', 'Caleb Wright', 'TR', '12:30', '13:45', 'Howey L4', [240, 202], [40, 0], 'B'),
      sec('87002', 'A01', 'Lab', 'TA Staff', 'T', '15:30', '18:15', 'Howey S106', [24, 22], [0, 0], 'A'),
      sec('87003', 'A02', 'Lab', 'TA Staff', 'R', '8:00', '10:45', 'Howey S106', [24, 24], [0, 0], 'A'),
      sec('87004', 'B01', 'Lab', 'TA Staff', 'M', '15:00', '17:45', 'Howey S108', [24, 10], [0, 0], 'B'),
      sec('87005', 'B02', 'Lab', 'TA Staff', 'W', '15:00', '17:45', 'Howey S108', [24, 21], [0, 0], 'B'),
    ],
  },
  {
    subject: 'PSYC', number: '1101', title: 'General Psychology', hours: 3,
    description: 'Introduction to the study of behavior and mental processes: perception, learning, memory, development, and social behavior.',
    attributes: ['Social Science'],
    instructors: { 'Margaret Lowe': 3.44 },
    sections: [
      sec('88010', 'A', 'Lecture', 'Margaret Lowe', 'MW', '12:30', '13:45', 'Clough 152', [300, 211]),
      sec('88011', 'B', 'Lecture', 'Margaret Lowe', 'TR', '9:30', '10:45', 'Clough 152', [300, 300], [30, 2]),
    ],
  },
  {
    subject: 'ECON', number: '2100', title: 'Economic Analysis&Policy', hours: 3,
    description: 'Microeconomic and macroeconomic analysis applied to policy issues.',
    attributes: ['Social Science'],
    instructors: { 'Daniel Kessler': 3.18, 'Fatima Noor': 3.29 },
    sections: [
      sec('89100', 'A', 'Lecture', 'Daniel Kessler', 'MWF', '11:00', '11:50', 'Old CE 104', [80, 61]),
      sec('89101', 'B', 'Lecture', 'Fatima Noor', 'TR', '15:30', '16:45', 'Old CE 104', [80, 74]),
    ],
  },
  {
    subject: 'CS', number: '4641', title: 'Machine Learning', hours: 3,
    description: 'Machine learning techniques and applications: supervised and unsupervised learning, model evaluation.',
    attributes: ['STEM USG', 'Tech Elect CS, Engr, &Sciences'],
    instructors: { 'Arjun Mehta': 3.22, 'Sofia Reyes': 3.40 },
    sections: [
      sec('90200', 'A', 'Lecture', 'Arjun Mehta', 'MW', '14:00', '15:15', 'Klaus 1443', [180, 179]),
      sec('90201', 'B', 'Lecture', 'Sofia Reyes', 'TR', '9:30', '10:45', 'Klaus 1443', [180, 144]),
      sec('90202', 'C', 'Lecture', 'Sofia Reyes', 'TR', '17:00', '18:15', 'Klaus 1443', [180, 60]),
    ],
  },
];

export const SUBJECTS = {
  CS: 'Computer Science',
  ECE: 'Electrical & Computer Engr',
  LMC: 'Literature, Media & Comm',
  MATH: 'Mathematics',
  PHYS: 'Physics',
  PSYC: 'Psychology',
  ECON: 'Economics',
};

function weightedGpa(c) {
  const lec = c.sections.filter((s) => c.instructors[s.instructor] != null);
  if (!lec.length) return null;
  const total = lec.reduce((a, s) => a + c.instructors[s.instructor] * s.seats.cap, 0);
  return total / lec.reduce((a, s) => a + s.seats.cap, 0);
}

export const COURSES = Object.fromEntries(
  RAW.map((c) => {
    const id = `${c.subject} ${c.number}`;
    const types = [...new Set(c.sections.map((s) => s.type))];
    const course = {
      ...c,
      id,
      subjectName: SUBJECTS[c.subject],
      primaryType: types[0],
      componentTypes: types.slice(1),
      sections: c.sections.map((s) => ({ ...s, courseId: id })),
    };
    course.gpa = weightedGpa(course);
    return [id, course];
  })
);

export const SECTIONS_BY_CRN = Object.fromEntries(
  Object.values(COURSES).flatMap((c) => c.sections.map((s) => [s.crn, s]))
);

export const ATTRIBUTES = [...new Set(RAW.flatMap((c) => c.attributes))].sort();
