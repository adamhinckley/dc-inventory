import { Suspense, type ReactNode } from "react";
import { Purchasing2Heading } from "../../../../components/purchasing-2-heading";
import { Purchasing2Workspace } from "../../../../components/purchasing-2-workspace";

export default function Purchasing2HubLayout({ children }: { children: ReactNode }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-region">
      <Purchasing2Heading />
      <Suspense>
        <Purchasing2Workspace>{children}</Purchasing2Workspace>
      </Suspense>
    </section>
  );
}
