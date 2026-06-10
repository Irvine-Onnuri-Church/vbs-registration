// ────────────────────────────────────────────────────────────────────────────
// Shared roster contract used by BOTH the client (instant paint + edit UI) and
// the server (Firestore seeding + key validation). Keeping the seed data and the
// id/validation helpers in one module is what guarantees the deterministic seed
// ids are byte-identical on both sides.
// ────────────────────────────────────────────────────────────────────────────

export const GRADE_ORDER = ['K', '1st', '2nd', '3rd', '4th', '5th', '6th'] as const;
export type Grade = (typeof GRADE_ORDER)[number];

export const GRADE_COLORS: Record<Grade, string> = {
  K: '#74C3DD',
  '1st': '#EE1C24',
  '2nd': '#F0915A',
  '3rd': '#F4CB3C',
  '4th': '#19A64E',
  '5th': '#4C50DF',
  '6th': '#8E2C6C',
};

type ClassRoster = { left: string[]; right: string[] };
type GradeRoster = Record<string, ClassRoster>;

// The original static class lists. This is the ONE-TIME seed for Firestore; once
// seeded, the Firestore `roster/students` doc is the source of truth.
export const ROSTER: Record<Grade, GradeRoster> = {
  K: {
    K1: { left: ['Ashet Oh', 'Billy Thompson', 'Earth Kim', 'Ezra Shim', 'Jude Jung', 'Paxton Yoon'], right: ['Ellie Park', 'Evelyn Lee', 'Jay Lee', 'Joelle Wang'] },
    K2: { left: ['Eric Cho', 'Ethan Park', 'Hajun Sa', 'Joshua Hong', 'Yijun Kim'], right: ['Alisa Choi', 'Melody Han', 'Taelin Kim', 'Taylor Kim', 'Himavarsha Kumar', 'Lea Neumann'] },
    K3: { left: ['Aiden Oh', 'Benjamin Jung', 'Ethan Kim', 'Gio Kim', 'Henry Cho', 'Nathan Lee'], right: ['Elena Park', 'Olivia Min', 'Stella Park', 'Yuha Hwang'] },
    K4: { left: ['Gio Kim', 'Robin Song', 'WooJoo Kim'], right: ['Ina Youn', 'Jayla Kim', 'Jisoo Park', 'Leah Seo', 'Seoyoo Lee', 'Suji Han', 'Yuna Kim (05/09/20)'] },
    K5: { left: ['Arthur Chang', 'Inyu Oh', 'Jiho Han', 'Jooho Cha', 'Mason Yoon'], right: ['Byul Kim', 'Joo-Ah Shin', 'Layla Shin', 'Rei Baik', 'Yuna Kim (04/28/20)'] },
    K6: { left: ['Joshua Ock', 'Ryden Chiou', 'Seungmin Ahn', 'Yunu Cho', 'Aryan Patel'], right: ['Dayoon Ko', 'Heejoo Yang', 'Isla Yoon', 'Junie Whang', 'Sofia Kim'] },
    K7: { left: ['Asher Kim', 'Gio Park', 'Ian Lee', 'Jordan Rough'], right: ['Eliana Kim', 'Erin Kim', 'Gianna Yoo', 'Hyenah Song', 'Noelle Choi'] },
  },
  '1st': {
    '1A': { left: ['Aiden Park', 'Gio Lee', 'Brent Carballo', 'Sky Jung', 'Seogeun Lee'], right: ['Leah He', 'Elise Kim', 'Chloe Liang', 'Ria Choi'] },
    '1B': { left: ['Noah Baek', 'Joshua Kim', 'Jacob Hong', 'Leo Jeong', 'Roy Chang'], right: ['Shanvika Karumujji', 'Olivia Chang', 'Emmy Neumann'] },
    '1C': { left: ['Akshiv Gupta', 'Sebastian Lee', 'Daniel Park', 'Sean Kim'], right: ['Allison Kwon', 'Hailey Kim', 'Joy Kim', 'Faith Ha'] },
    '1D': { left: ['Ethan Chang', 'Yohan Jang', 'Jacob Kim', 'Daniel Lee', 'Ian Choi'], right: ['Olivia Pai', 'Everlyn Oh', 'Ellis Kim'] },
    '1E': { left: ['Aisultan Ural', 'Benjamin Serpa', 'Heewon Ku', 'Ethan Lee', 'Eden Moon'], right: ['Heidi Han', 'Karley Fung', 'Jayleen Hur'] },
  },
  '2nd': {
    '2A': { left: ['Cayden Won', 'Simon Park', 'Christian Oh', 'Nathaniel Ha'], right: ['Audrey Nam', 'Eleanor Yune', 'Claire Chang', 'Emma Yang', 'Yejee Bang'] },
    '2B': { left: ['Charlie Whang', 'Aiden Kim', 'Matthew Kim'], right: ['Paige Chong', 'Calla Rough', 'Maxine Koh-Parsons', 'Yuha Kim', 'Jeongyoon Moon', 'Gian Kim'] },
    '2C': { left: ['Ellis Baik', 'Dylan Lee', 'Brian Song'], right: ['Dana Kim', 'Corrie Whang', 'Alena Bueno', 'Lindsay Liew', 'Jaea Choi', 'Yullie Jung'] },
  },
  '3rd': {
    '3A': { left: ['Liam Choi', 'Hageun Lee', 'Siwoo Yang', 'Jacob Choi'], right: ['Emma Medina', 'Seoyeong Lee', 'Soul Lee', 'Clover Jung', 'Rena Oh', 'Lily Park'] },
    '3B': { left: ['Evan Hwang', 'Aabhash Patel', 'Elliott Chang'], right: ['Chelsea Mawji', 'Priscilla Ryu', 'Kaitlyn Kim', 'Adelynn Won', 'Soul Kim', 'Chloe Kwon'] },
    '3C': { left: ['Luke Lim', 'Asher Eom', 'Jiun Lim'], right: ['Joy Kim', 'Jamie Lee', 'Olivia Park', 'Valentina Torres', 'Ellie Choi', 'Elisha Kim'] },
  },
  '4th': {
    '4A': { left: ['Evan Yang', 'Aaron Yoo', 'Leon Jeong', 'Haejin Kim', 'Luke Kim'], right: ['Jane Richardson', 'Joy Kim', 'Janet Hur', 'Liann Kim'] },
    '4B': { left: ['Daniel Kim', 'Clayton Choi', 'Shaun Kim', 'Roy Kim'], right: ['Charlotte Liang', 'Ashley Xiao', 'Ailyn Kim', 'Mackenzie Kim'] },
    '4C': { left: ['Jeremy Liew', 'Darron Lee', 'Youngmin Park', 'Timothy Park'], right: ['Charlotte Mawji', 'Hayeon Cho', 'Jimin Park', 'Amy Kim'] },
    '4D': { left: ['Daniel Lee', 'Joshua Park', 'Evan Baik', 'Logan Shin', 'Jonathan Ryu'], right: ['Jiyu Song', 'Terri Kim', 'Seoyoon Ko'] },
    '4E': { left: ['Elias Kim', 'Ian Lee', 'Caleb Lee', 'Elliot Hong', 'Blake Carballo'], right: ['Isabel Choi', 'Kaylee Kim', 'Mina Kim'] },
  },
  '5th': {
    '5A': { left: ['Nathan Jung', 'Siho Yang', 'Eugene Kim', 'Andy Song', 'Elijah Shin', 'Rihwan Kim', 'Daniel Kim', 'Jaeyul Ryu'], right: ['Eunhu Lee', 'Hara Jang', 'Charlotte Chiou'] },
    '5B': { left: ['Emiliano Medina', 'Asher Oh', 'Jackson Fung', 'Harrison Lee', 'Jaden Hwang'], right: ['Sofia Torres', 'Yein Park', 'Faith Lee', 'Ellie Jung'] },
    '5C': { left: ['Jackson Koh-Parsons', 'Jeonghun Yeom', 'Robin Kim', 'Samuel Moon', 'Nathan Choi', 'Jake Kang', 'Jonah Min'], right: ['Jenny Kim', 'Eliana Park', 'Celine Chang', 'Geo Kwak'] },
  },
  '6th': {
    '6A': { left: ['Jayden Hur', 'Micah Chang', 'Ethan Eom', 'Jonah Min'], right: ['Kiwi Gupta', 'Audrey Han', 'Rachel Kahng', 'Euna Kim'] },
    '6B': { left: ['Ethan Song', 'Heesoo Yang', 'James Kim', 'Noul Lee'], right: ['Yumin Kim', 'Seohee Cho', 'Jordan Lee'] },
  },
};

// Class display order per grade, derived from the seed's insertion order.
export const CLASS_ORDER: Record<Grade, string[]> = Object.fromEntries(
  GRADE_ORDER.map((g) => [g, Object.keys(ROSTER[g])]),
) as Record<Grade, string[]>;

export type Col = 'L' | 'R';
export type StudentRecord = { grade: Grade; cls: string; col: Col; order: number; name: string; note: string };
export type RosterMap = Record<string, StudentRecord>;

// Deterministic id for an original (seeded) student. Format is identical to the
// OLD check-in key `grade|class|side|index`, so existing check-in data — which is
// keyed by these strings — keeps working with zero migration.
export function seedId(grade: Grade, cls: string, col: Col, order: number): string {
  return `${grade}|${cls}|${col}|${order}`;
}

// Build the full seed map. Same function runs on the client (initial state /
// instant paint) and the server (Firestore seeding) → byte-identical ids.
export function buildSeedMap(): RosterMap {
  const map: RosterMap = {};
  for (const grade of GRADE_ORDER) {
    for (const cls of Object.keys(ROSTER[grade])) {
      const { left, right } = ROSTER[grade][cls];
      left.forEach((name, i) => {
        map[seedId(grade, cls, 'L', i)] = { grade, cls, col: 'L', order: i, name, note: '' };
      });
      right.forEach((name, i) => {
        map[seedId(grade, cls, 'R', i)] = { grade, cls, col: 'R', order: i, name, note: '' };
      });
    }
  }
  return map;
}

// Validates BOTH seed ids (`grade|class|L|index`) and new ids (`new|<uuid>`).
// Shared by the roster route and the roster-checkin route so every student-slot
// key is validated against a single scheme.
export const STUDENT_ID_RE =
  /^((K|1st|2nd|3rd|4th|5th|6th)\|[A-Za-z0-9]+\|[LR]\|\d+|new\|[0-9a-fA-F-]{36})$/;
