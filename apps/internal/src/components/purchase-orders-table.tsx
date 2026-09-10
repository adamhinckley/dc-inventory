"use client";

import {
  getListInternalPurchaseOrdersQueryKey,
  listInternalPurchaseOrdersTable,
  useCancelInternalPurchaseOrder,
  useListInternalPurchaseOrders,
} from "@dc-inventory/api-client-internal";
import { Button, Chip } from "@dc-inventory/ui";
import {
  DataTable,
  type ListQueryHook,
  type ListQueryParams,
} from "@dc-inventory/ui-internal";
import { useQueryClient } from "@tanstack/react-query";
import { Ban } from "lucide-react";
import Link from "next/link";
import { useCallback, useState, type CSSProperties, type ReactNode } from "react";
import { cancelPurchaseOrderErrorMessage } from "../lib/purchase-order-action-errors";
import { purchaseOrderStatusPresentation } from "../lib/purchase-order-status-chip";
import { replaceTableUrlParams } from "../lib/table-url-params";

function useDraftPurchaseOrdersList(
  params?: Parameters<typeof useListInternalPurchaseOrders>[0],
) {
  return useListInternalPurchaseOrders({
    ...params,
    status: "draft",
  });
}

export function PurchaseOrdersTable({
  initialParams,
}: {
  initialParams?: ListQueryParams;
}) {
  const queryClient = useQueryClient();
  const cancelMutation = useCancelInternalPurchaseOrder();
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const onParamsChange = useCallback((params: ListQueryParams) => {
    replaceTableUrlParams(listInternalPurchaseOrdersTable, params);
  }, []);

  const getRowHref = useCallback((row: { id?: string }) => {
    return row.id ? `/procurement/purchase-orders/${row.id}` : undefined;
  }, []);

  const renderRowLink = useCallback(
    ({ href, children }: { href: string; children: ReactNode }) => (
      <Link href={href} className="text-link hover:text-link-hover">
        {children}
      </Link>
    ),
    [],
  );

  const cancelDraft = useCallback(
    async (purchaseOrderId: string) => {
      setActionError(null);
      setCancellingId(purchaseOrderId);
      try {
        const result = await cancelMutation.mutateAsync({
          id: purchaseOrderId,
          data: { idempotencyKey: `cancel-${purchaseOrderId}` },
        });
        if (result.status !== 200) {
          setActionError(cancelPurchaseOrderErrorMessage(result));
          return;
        }
        await queryClient.invalidateQueries({
          queryKey: getListInternalPurchaseOrdersQueryKey(),
        });
      } catch {
        setActionError("Could not cancel this purchase order.");
      } finally {
        setCancellingId(null);
      }
    },
    [cancelMutation, queryClient],
  );

  const rowActions = useCallback(
    (row: Record<string, unknown>) => {
      const id = typeof row.id === "string" ? row.id : "";
      if (id.length === 0 || row.status !== "draft") {
        return null;
      }
      const pending = cancellingId === id;
      return (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending || cancelMutation.isPending}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void cancelDraft(id);
          }}
        >
          <Ban className="size-icon" aria-hidden />
          {pending ? "Cancelling…" : "Cancel"}
        </Button>
      );
    },
    [cancelDraft, cancelMutation.isPending, cancellingId],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-form-section">
      {actionError ? (
        <p className="text-body-sm text-error" role="alert">
          {actionError}
        </p>
      ) : null}
      <DataTable.Root
        meta={listInternalPurchaseOrdersTable}
        queryHook={useDraftPurchaseOrdersList as ListQueryHook<
          Parameters<typeof useListInternalPurchaseOrders>[0]
        >}
        initialParams={initialParams}
        onParamsChange={onParamsChange}
        getRowHref={getRowHref}
        linkField="documentNumber"
        renderRowLink={renderRowLink}
        rowActions={rowActions}
        renderColumns={{
          status: (row) => {
            const presentation = purchaseOrderStatusPresentation(row.status);
            if (presentation === null) {
              return "—";
            }
            return (
              <Chip
                icon={<Chip.Dot />}
                style={{ "--chip-color": presentation.color } as CSSProperties}
              >
                {presentation.label}
              </Chip>
            );
          },
        }}
        idPrefix="draft-purchase-orders"
      >
        <DataTable.Table />
        <DataTable.Pagination />
      </DataTable.Root>
    </div>
  );
}
