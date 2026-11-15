import ClientWorkspaceShell from "@/components/client/ClientWorkspaceShell";
import ClientCalendar from "@/components/client/calendar/ClientCalendar";

export default function ClientCalendarPage() {
  return (
    <ClientWorkspaceShell title="Calendar">
      <ClientCalendar />
    </ClientWorkspaceShell>
  );
}
