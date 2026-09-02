"use client";

import { ExplorerView } from "@dc-inventory/ui";
import type { ListQueryParams } from "@dc-inventory/ui-internal";
import { ReceivingInboundTable } from "./receiving-inbound-table";

export function ReceivingInboundExplorer({
  initialParams,
}: {
  initialParams?: ListQueryParams;
}) {
  return (
    <ExplorerView className="h-full min-h-0">
      <ExplorerView.Header className="border-b-0 pb-tight">
        <header>
          <h1 className="page-title">Confirmed Purchase Orders</h1>
        </header>
      </ExplorerView.Header>
      <ExplorerView.Content className="pt-tight">
        <ReceivingInboundTable initialParams={initialParams} />
      </ExplorerView.Content>
    </ExplorerView>
  );
}
