import { Suspense } from "react";
import { AccountingPagePrototype } from "../../../components/accounting-page.prototype";

// PROTOTYPE branch only — main keeps the DashboardPlaceholder here until AR 7.
export default function AccountingPage() {
  return (
    <Suspense>
      <AccountingPagePrototype />
    </Suspense>
  );
}
