import { ReactNode } from "react";

export function DashboardShell({ children }: { children: ReactNode }) {
  return <div className="px-6 py-6">{children}</div>;
}

