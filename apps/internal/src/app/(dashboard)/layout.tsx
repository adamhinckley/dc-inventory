import type { ReactNode } from "react";
import { DashboardFrame } from "../../components/dashboard-frame";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardFrame>{children}</DashboardFrame>;
}
