import PageContainer from '@/components/PageContainer';
import SectionTitle from '@/components/SectionTitle';

const sampleRegistrations = [
  {
    parent: 'Sarah Johnson',
    email: 'sarah@example.com',
    children: 'Emma, Noah',
    paymentStatus: 'Pending',
    refundStatus: 'None',
  },
  {
    parent: 'Michael Lee',
    email: 'michael@example.com',
    children: 'Olivia',
    paymentStatus: 'Paid',
    refundStatus: 'Not requested',
  },
  {
    parent: 'Ashley Carter',
    email: 'ashley@example.com',
    children: 'Liam, Harper',
    paymentStatus: 'Partially paid',
    refundStatus: 'Under review',
  },
];

export default function AdminPage() {
  return (
    <PageContainer className="space-y-8">
      <section className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">Admin</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Admin Dashboard Placeholder</h1>
        <p className="max-w-3xl text-base leading-7 text-slate-600">
          This starter dashboard uses static sample data. Later, replace it with secured admin data from Supabase.
        </p>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <SectionTitle
          title="Registration Overview"
          description="Preview the table layout for the admin experience before real data and filtering are added."
        />
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Parent</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Children</th>
                  <th className="px-4 py-3 font-semibold">Payment Status</th>
                  <th className="px-4 py-3 font-semibold">Refund Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white text-slate-700">
                {sampleRegistrations.map((registration) => (
                  <tr key={registration.email}>
                    <td className="px-4 py-4 font-medium text-slate-900">{registration.parent}</td>
                    <td className="px-4 py-4">{registration.email}</td>
                    <td className="px-4 py-4">{registration.children}</td>
                    <td className="px-4 py-4">{registration.paymentStatus}</td>
                    <td className="px-4 py-4">{registration.refundStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </PageContainer>
  );
}
