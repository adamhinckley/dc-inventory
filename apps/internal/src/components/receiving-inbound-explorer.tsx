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
    <ExplorerView className="min-h-[calc(100vh-12rem)]">
      <ExplorerView.Header>
        <header className="mt-2">
          <p className="text-label text-fg-secondary">Receiving</p>
          <h1 className="page-title mt-1">Inbound</h1>
          <p className="page-description mt-2">
            Confirmed purchase orders awaiting receipt.
          </p>
        </header>
      </ExplorerView.Header>
      <ExplorerView.Content>
        <ReceivingInboundTable initialParams={initialParams} />
      </ExplorerView.Content>
    </ExplorerView>
  );
}
