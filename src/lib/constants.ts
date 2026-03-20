export const EVENT_INFO = {
  name: 'VBS Registration',
  year: '2026',
  dates: 'July 15-18, 2026',
  registrationFee: '$35 per child',
  registrationFeeAmount: 35,
  parentGuidePdfPath: '/docs/parent-guide.pdf',
} as const;

export const EVENT_DETAILS = [
  { label: 'Location', value: 'Main Campus Fellowship Hall' },
  { label: 'Time', value: '6:00 PM - 8:30 PM nightly' },
  { label: 'Ages', value: 'Children entering kindergarten through 5th grade' },
];

export const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/register', label: 'Register' },
  { href: '/mypage', label: 'My Page' },
];
