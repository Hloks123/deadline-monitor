import Link from "next/link";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";

type RecurringTasksUnavailableProps = {
  title: string;
  message: string;
};

export default function RecurringTasksUnavailable({
  title,
  message,
}: RecurringTasksUnavailableProps) {
  return (
    <WorkspaceShell
      eyebrow="Task Management"
      title={title}
    >
      <section className="m-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm lg:m-8">
        <h2 className="text-xl font-bold text-slate-950">
          Recurring tasks are not available yet
        </h2>
        <p className="mt-2 max-w-2xl leading-7 text-slate-600">
          {message}
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-teal-600 px-5 font-semibold text-white hover:bg-teal-700"
        >
          Back to Dashboard
        </Link>
      </section>
    </WorkspaceShell>
  );
}
