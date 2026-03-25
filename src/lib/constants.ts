export const EVENT_INFO = {
  name: 'VBS Registration',
  year: '2025',
  dates: 'July 21-24, 2025',
  location: 'Grace Church Fellowship Hall',
  shortDescription:
    'Join us for a joyful week of Bible lessons, music, crafts, games, and summer fun for the whole family.',
  registrationFee: '$35 per child',
  registrationFeeAmount: 35,
  parentGuidePdfPath: '/docs/parent-guide.pdf',
  earlyRegistrationDeadline: '2025-05-03',
} as const;

export const REGISTRATION_PRICING = {
  early: {
    beginner: 40,
    standard: 80,
  },
  regular: {
    beginner: 50,
    standard: 100,
  },
} as const;

export const EVENT_DETAILS = [
  { label: 'Dates', value: EVENT_INFO.dates },
  { label: 'Location', value: EVENT_INFO.location },
  { label: 'Ages', value: 'Children entering kindergarten through 5th grade' },
];

export const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/register', label: 'Register' },
  { href: '/mypage', label: 'My Page' },
];
