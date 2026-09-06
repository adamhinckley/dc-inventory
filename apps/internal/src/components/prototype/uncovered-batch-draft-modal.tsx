"use client";

import { Button, Dialog } from "@dc-inventory/ui";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type { PrototypeDraftResult } from "./uncovered-vendor-prototype-mock";

export function UncoveredBatchDraftModal({
  open,
  drafts,
  unmappedSkus,
  onOpenChange,
}: {
  open: boolean;
  drafts: readonly PrototypeDraftResult[];
  unmappedSkus: readonly string[];
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content size="md" data-testid="uncovered-batch-draft-modal">
        <Dialog.Header>
          <Dialog.Title>
            {drafts.length} draft purchase order{drafts.length === 1 ? "" : "s"} created
          </Dialog.Title>
          <Dialog.Close />
        </Dialog.Header>
        <Dialog.Body className="flex flex-col gap-field-group">
          <Dialog.Description>
            One draft per factory in your selection. Open each PO to review lines and
            suggested quantities before confirming.
          </Dialog.Description>
          <ul className="flex flex-col gap-field">
            {drafts.map((draft) => (
              <li
                key={draft.purchaseOrderId}
                className="flex items-center justify-between gap-action rounded-section border border-border px-item-x py-item-y"
              >
                <div className="min-w-0">
                  <p className="text-body-sm font-medium truncate">{draft.supplierName}</p>
                  <p className="text-body-sm text-fg-secondary">
                    {draft.documentNumber} · {draft.lineCount} line
                    {draft.lineCount === 1 ? "" : "s"}
                  </p>
                </div>
                <Link
                  href={`/purchasing/${draft.purchaseOrderId}`}
                  className="shrink-0"
                >
                  <Button type="button" variant="secondary" size="sm">
                    <ExternalLink className="size-icon-lg" aria-hidden />
                    Open
                  </Button>
                </Link>
              </li>
            ))}
          </ul>
          {unmappedSkus.length > 0 ? (
            <p className="text-body-sm text-fg-secondary" role="status">
              Skipped {unmappedSkus.length} SKU(s) with no factory mapping:{" "}
              {unmappedSkus.join(", ")}
            </p>
          ) : null}
        </Dialog.Body>
        <Dialog.Footer>
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Done
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
