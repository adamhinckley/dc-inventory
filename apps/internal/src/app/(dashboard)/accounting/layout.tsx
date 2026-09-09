import { Suspense, type ReactNode } from "react";
import { AccountingExplorer } from "../../../components/accounting-explorer";

export default function AccountingLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <AccountingExplorer>{children}</AccountingExplorer>
    </Suspense>
  );
}
