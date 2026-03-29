export const EVENT_INFO = {
  name: 'VBS 2026',
  subtitle: 'Kingdom Quest',
  church: 'Irvine Onnuri Church',
  year: '2026',
  dates: 'June 10–13, 2026',
  beginnerDates: 'June 12–13, 2026',
  location: 'Irvine Onnuri Church',
  address: '17200 Jamboree Rd, Irvine, CA 92614',
  shortDescription:
    'Join us for Kingdom Quest — a week of Bible lessons, worship, crafts, and games for the whole family at Irvine Onnuri Church.',
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
  { label: 'Regular VBS (K–6th)', value: EVENT_INFO.dates },
  { label: 'Beginner VBS (Preschool)', value: EVENT_INFO.beginnerDates },
  { label: 'Location', value: `${EVENT_INFO.location} — ${EVENT_INFO.address}` },
];

export const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/register', label: 'Register' },
  { href: '/mypage', label: 'My Page' },
];
