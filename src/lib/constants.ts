export const EVENT_INFO = {
  name: 'VBS 2026',
  subtitle: 'Kingdom Quest',
  scripture: 'John 8:12 — "I am the light of the world."',
  church: 'Irvine Onnuri Church',
  year: '2026',
  dates: 'June 10–13, 2026',
  times: 'Wed–Fri 3:00–7:00 PM · Sat 9:00 AM–1:00 PM',
  location: 'Irvine Onnuri Church',
  address: '17200 Jamboree Rd, Irvine, CA 92614',
  contactName: 'Pastor Jeana Lee',
  contactPhone: '(818) 312-2173',
  shortDescription:
    'Join us for Kingdom Quest — a week of Bible lessons, worship, crafts, and games at Irvine Onnuri Church.',
  registrationFee: '$35 per child',
  registrationFeeAmount: 35,
  parentGuidePdfPath: '/docs/parent-guide.pdf',
  earlyRegistrationStart: '2026-03-01',
  earlyRegistrationDeadline: '2026-05-03',
  regularRegistrationStart: '2026-05-04',
  registrationDeadline: '2026-05-31',
} as const;

export const REGISTRATION_PRICING = {
  early: {
    beginner: 40,
    standard: 70,
  },
  regular: {
    beginner: 50,
    standard: 90,
  },
} as const;

export const EVENT_DETAILS = [
  { label: 'Dates', value: EVENT_INFO.dates },
  { label: 'Times', value: EVENT_INFO.times },
  { label: 'Who', value: 'Kinder – 6th Grade' },
  { label: 'Location', value: `${EVENT_INFO.location} — ${EVENT_INFO.address}` },
];

export const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/mypage', label: 'My Registration' },
];
