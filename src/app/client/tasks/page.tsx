"use client";

import ClientWorkspaceShell from "@/components/client/ClientWorkspaceShell";
import ClientTasksView from "@/components/client/work/ClientTasksView";

export default function ClientTasksPage() {
  return (
    <ClientWorkspaceShell title="My Tasks">
      <ClientTasksView />
    </ClientWorkspaceShell>
  );
}
