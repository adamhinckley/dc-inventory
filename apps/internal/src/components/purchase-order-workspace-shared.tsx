"use client";

import { Button, Dialog } from "@dc-inventory/ui";
import { useGetInternalSupplier } from "@dc-inventory/api-client-internal";
import { Download, Package } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { missingCaseQtyRowElementId } from "../lib/factory-send-table";

export function DashboardTopbarPortal({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setTarget(document.getElementById("dashboard-topbar-actions"));
  }, []);
  if (target === null) {
    return null;
  }
  return createPortal(children, target);
}

function scrollToMissingCaseQtyRow(sku: string) {
  document
    .getElementById(missingCaseQtyRowElementId(sku))
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function SupplierName({ supplierId }: { supplierId: string }) {
  const supplierQuery = useGetInternalSupplier(supplierId);
  if (supplierQuery.data?.status !== 200) {
    return null;
  }
  return (
    <p className="text-body-sm text-fg-secondary mt-2">
      Vendor: {supplierQuery.data.data.name}
    </p>
  );
}

export function MissingCaseQtyDownloadDialog({
  open,
  sku,
  onOpenChange,
  onProceed,
}: {
  open: boolean;
  sku: string;
  onOpenChange: (open: boolean) => void;
  onProceed: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        size="sm"
        data-testid="purchasing-po-missing-case-qty-dialog"
      >
        <Dialog.Header>
          <Dialog.Title>Case quantity is missing</Dialog.Title>
          <Dialog.Close />
        </Dialog.Header>
        <Dialog.Body>
          <Dialog.Description>
            The XLS leaves tot_cartons blank when any line is missing case
            quantity. Enter case qty on {sku} before download, or continue
            without that column.
          </Dialog.Description>
        </Dialog.Body>
        <Dialog.Footer>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
              onProceed();
            }}
          >
            <Download className="size-icon-lg" aria-hidden />
            Download Anyway
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              onOpenChange(false);
              window.setTimeout(() => {
                scrollToMissingCaseQtyRow(sku);
              }, 200);
            }}
          >
            <Package className="size-icon-lg" aria-hidden />
            Add Case Quantity
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}

export function shouldWarnBeforeFactorySendDownload(
  factorySendReady: boolean,
  factorySendFetching: boolean,
  missingCaseQtySku: string | null,
): boolean {
  return factorySendReady && !factorySendFetching && missingCaseQtySku !== null;
}
