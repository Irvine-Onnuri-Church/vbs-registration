import PageContainer from '@/components/PageContainer';

export default function LoginPage() {
  return (
    <PageContainer className="flex items-center justify-center">
      <section className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">Login</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Magic Link Login Placeholder</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Connect Supabase magic link authentication here in a future step.
        </p>

        <form className="mt-8 space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-slate-700">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              placeholder="parent@example.com"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            />
          </div>
          <button
            type="button"
            className="inline-flex w-full items-center justify-center rounded-full bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            Send Magic Link
          </button>
        </form>
      </section>
    </PageContainer>
  );
}
