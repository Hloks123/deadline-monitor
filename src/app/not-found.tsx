import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-900">
      <section className="max-w-lg text-center">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-700">
          Deadline Monitor
        </p>
        <h1 className="mt-4 text-4xl font-bold">Page not found</h1>
        <p className="mt-4 leading-7 text-slate-600">
          The page may have moved, or the address may be incorrect.
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex min-h-11 items-center rounded-lg bg-teal-700 px-5 py-2.5 font-semibold text-white hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          Return to home
        </Link>
      </section>
    </main>
  );
}
