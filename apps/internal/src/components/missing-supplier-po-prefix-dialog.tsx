"use client";

import { Button, Dialog } from "@dc-inventory/ui";
import { FilePlus2, Pencil } from "lucide-react";
import Link from "next/link";
import type { SupplierDetail } from "../lib/supplier-types";

function supplierEditHref(supplierId: string): string {
  return `/procurement/suppliers/${supplierId}`;
}

export function MissingSupplierPoPrefixDialog({
  open,
  suppliers,
  pending = false,
  onOpenChange,
  onSubmitAnyway,
}: {
  open: boolean;
  suppliers: readonly SupplierDetail[];
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitAnyway: () => void;
}) {
  const names = suppliers.map((supplier) => supplier.name).join(", ");
  const only = suppliers[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content size="md" data-testid="missing-supplier-po-prefix-dialog">
        <Dialog.Header>
          <Dialog.Title>PO Prefix Missing</Dialog.Title>
          <Dialog.Close />
        </Dialog.Header>
        <Dialog.Body className="flex flex-col gap-field-group">
          <Dialog.Description>
            {suppliers.length === 1
              ? `${names} has no PO prefix. You can still create the draft purchase order. Warehouse will not have a prefix to read off the box until you add one.`
              : `${names} have no PO prefix. You can still create the draft purchase orders. Warehouse will not have a prefix to read off the box until you add one.`}
          </Dialog.Description>
          {suppliers.length > 1 ? (
            <ul className="flex flex-col gap-field">
              {suppliers.map((supplier) => (
                <li
                  key={supplier.id}
                  className="flex items-center justify-between gap-action rounded-section border border-border px-item-x py-item-y"
                >
                  <p className="min-w-0 truncate text-body-sm font-medium">{supplier.name}</p>
                  <Link href={supplierEditHref(supplier.id)} className="shrink-0">
                    <Button type="button" variant="secondary" size="sm">
                      <Pencil className="size-icon-lg" aria-hidden />
                      Edit Prefix
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </Dialog.Body>
        <Dialog.Footer>
          {only !== undefined && suppliers.length === 1 ? (
            <Link href={supplierEditHref(only.id)}>
              <Button type="button" variant="secondary">
                <Pencil className="size-icon" aria-hidden />
                Edit Prefix
              </Button>
            </Link>
          ) : null}
          <Button
            type="button"
            variant="primary"
            disabled={pending}
            onClick={onSubmitAnyway}
          >
            <FilePlus2 className="size-icon" aria-hidden />
            Submit Anyway
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
