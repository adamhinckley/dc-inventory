"use client";

import { Button, Dialog } from "@dc-inventory/ui";
import { FilePlus2, Pencil } from "lucide-react";
import type { SupplierRow } from "../lib/supplier-types";
import { SupplierEditDialog } from "./supplier-edit-dialog";
import { useState } from "react";

export function MissingSupplierPoPrefixDialog({
  open,
  suppliers,
  pending = false,
  onOpenChange,
  onSubmitAnyway,
}: {
  open: boolean;
  suppliers: readonly SupplierRow[];
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitAnyway: () => void;
}) {
  const [editing, setEditing] = useState<SupplierRow | null>(null);
  const names = suppliers.map((supplier) => supplier.name).join(", ");

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            setEditing(null);
          }
          onOpenChange(next);
        }}
      >
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
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditing(supplier);
                      }}
                    >
                      <Pencil className="size-icon-lg" aria-hidden />
                      Edit Prefix
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </Dialog.Body>
          <Dialog.Footer>
            {suppliers.length === 1 ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const only = suppliers[0];
                  if (only !== undefined) {
                    setEditing(only);
                  }
                }}
              >
                <Pencil className="size-icon" aria-hidden />
                Edit Prefix
              </Button>
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

      {editing ? (
        <SupplierEditDialog
          supplier={editing}
          open
          onOpenChange={(next) => {
            if (!next) {
              setEditing(null);
            }
          }}
        />
      ) : null}
    </>
  );
}
