"use client";

import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import AccountSecurityPanel from "@/components/account/AccountSecurityPanel";

export default function AccountPage() {
  return (
    <WorkspaceShell eyebrow="Account" title="Account & Security">
      <AccountSecurityPanel />
    </WorkspaceShell>
  );
}
