import { REGISTRATION_PRICING } from '@/lib/constants';

type PricingTier = 'beginner' | 'standard';

export function formatPageTitle(title: string): string {
  return `${title} | VBS Registration`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatDateLabel(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00`);

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function isEarlyRegistration(currentDate: Date, earlyDeadline: string): boolean {
  const deadline = new Date(`${earlyDeadline}T23:59:59`);
  return currentDate <= deadline;
}

export function getPricingTierFromGrade(grade: string): PricingTier {
  return grade === 'Pre-K' ? 'beginner' : 'standard';
}

export function calculateChildPrice(grade: string, earlyRegistration: boolean): number {
  const pricingTier = getPricingTierFromGrade(grade);
  const pricingGroup = earlyRegistration ? REGISTRATION_PRICING.early : REGISTRATION_PRICING.regular;

  return pricingGroup[pricingTier];
}
