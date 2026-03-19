import PageContainer from '@/components/PageContainer';
import SectionTitle from '@/components/SectionTitle';

const registrationSections = [
  {
    title: 'Parent Information',
    description: 'Future fields for parent name, phone number, emergency contact, and address.',
  },
  {
    title: 'Child Information',
    description: 'Future fields for child details, grade, allergies, medical notes, and permissions.',
  },
  {
    title: 'Payment',
    description: 'Future order summary and fee collection area for registration checkout.',
  },
];

export default function RegisterPage() {
  return (
    <PageContainer className="space-y-8">
      <section className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">Register</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Registration Form Placeholder</h1>
        <p className="max-w-3xl text-base leading-7 text-slate-600">
          This page is prepared for the future registration flow. Form validation, Supabase storage, and payment
          processing will be added in later steps.
        </p>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <SectionTitle
          title="Future Registration Sections"
          description="Use these starter cards as a clean layout for the real form experience."
        />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {registrationSections.map((section) => (
            <article key={section.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-lg font-semibold text-slate-900">{section.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{section.description}</p>
            </article>
          ))}
        </div>
        <div className="mt-6 rounded-2xl border border-dashed border-sky-300 bg-sky-50 p-4 text-sm text-sky-900">
          PayPal checkout will be integrated later.
        </div>
      </section>
    </PageContainer>
  );
}
