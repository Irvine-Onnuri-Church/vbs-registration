import PageContainer from '@/components/PageContainer';
import SectionTitle from '@/components/SectionTitle';

const historyItems = [
  { child: 'Emma Johnson', status: 'Registered', date: 'April 2, 2026' },
  { child: 'Noah Johnson', status: 'Pending documents', date: 'April 3, 2026' },
];

export default function MyPage() {
  return (
    <PageContainer className="space-y-8">
      <section className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">My Page</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Family Account Overview</h1>
        <p className="max-w-3xl text-base leading-7 text-slate-600">
          This static mock page previews where families will review registration history, payment updates, and refund
          requests.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <SectionTitle
            title="Registration History"
            description="Example family registrations will eventually come from your database."
          />
          <div className="mt-6 space-y-4">
            {historyItems.map((item) => (
              <div key={item.child} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{item.child}</h2>
                    <p className="text-sm text-slate-600">Submitted on {item.date}</p>
                  </div>
                  <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <SectionTitle title="Payment Status" description="Static preview of future invoice and payment tracking." />
            <div className="mt-5 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span>Total Due</span>
                <span className="font-semibold text-slate-900">$70.00</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span>Payment State</span>
                <span className="font-semibold text-amber-600">Awaiting checkout</span>
              </div>
            </div>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <SectionTitle title="Refund Request" description="A future form can be added here for cancellation requests." />
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              Refund requests are not yet connected. Add policy text, a request workflow, and administrator review in a
              later step.
            </div>
          </section>
        </div>
      </section>
    </PageContainer>
  );
}
