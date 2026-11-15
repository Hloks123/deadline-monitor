import type { ReactNode } from "react";

type WorkspaceCommandBarProps = {
  children: ReactNode;
};

export default function WorkspaceCommandBar({ children }: WorkspaceCommandBarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Page actions"
      className="flex min-h-10 shrink-0 flex-wrap items-center justify-end gap-2"
    >
      {children}
    </div>
  );
}
