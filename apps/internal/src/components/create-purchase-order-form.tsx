"use client";

import {
  getListInternalPurchaseOrdersQueryKey,
  useCreateInternalPurchaseOrder,
  useListInternalSuppliers,
  type listInternalSuppliersResponse,
} from "@dc-inventory/api-client-internal";
import { Button, Input, Label } from "@dc-inventory/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

const fieldSelectClassName =
  "flex min-h-(--space-input-height) w-full rounded-interactable border border-border-field bg-surface-card px-input-x py-input-y text-input text-fg";

type DraftLine = {
  sku: string;
  name: string;
  qty: string;
};

function emptyLine(): DraftLine {
  return { sku: "", name: "", qty: "1" };
}

function supplierItems(response: listInternalSuppliersResponse | undefined) {
  if (response === undefined || response.status !== 200) {
    return [];
  }
  return response.data.items;
}

export function CreatePurchaseOrderForm() {
  const queryClient = useQueryClient();
  const suppliersQuery = useListInternalSuppliers();
  const create = useCreateInternalPurchaseOrder();
  const suppliers = supplierItems(suppliersQuery.data);
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (supplierId === "") {
      setError("Pick a supplier.");
      return;
    }

    const parsed = lines.map((line) => ({
      sku: line.sku.trim(),
      name: line.name.trim(),
      qty: Number.parseInt(line.qty, 10),
    }));
    if (
      parsed.some(
        (line) => line.sku === "" || line.name === "" || !Number.isInteger(line.qty) || line.qty < 1,
      )
    ) {
      setError("Each line needs a SKU, name, and quantity of 1 or more.");
      return;
    }

    create.mutate(
      { data: { supplierId, lines: parsed } },
      {
        onSuccess: (response) => {
          const documentNumber =
            response.status === 201 ? response.data.documentNumber : "draft";
          setNotice(`Created ${documentNumber} as a draft.`);
          setLines([emptyLine()]);
          void queryClient.invalidateQueries({
            queryKey: getListInternalPurchaseOrdersQueryKey(),
          });
        },
        onError: () => {
          setError("Could not create the purchase order.");
        },
      },
    );
  }

  return (
    <form
      className="flex max-w-3xl flex-col gap-field-group"
      onSubmit={onSubmit}
    >
      <div className="flex flex-col gap-field">
        <Label htmlFor="po-supplier">Supplier</Label>
        <select
          id="po-supplier"
          className={fieldSelectClassName}
          value={supplierId}
          onChange={(event) => setSupplierId(event.target.value)}
          disabled={suppliersQuery.isPending || suppliers.length === 0}
        >
          <option value="">
            {suppliers.length === 0 ? "No suppliers seeded" : "Select a supplier"}
          </option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.vendorNumber} — {supplier.name}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col gap-field">
        <legend className="form-label">Lines</legend>
        {lines.map((line, index) => (
          <div
            key={index}
            className="grid gap-field sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_6rem]"
          >
            <div className="flex flex-col gap-field">
              <Label htmlFor={`po-sku-${String(index)}`}>SKU</Label>
              <Input
                id={`po-sku-${String(index)}`}
                value={line.sku}
                onChange={(event) =>
                  setLines((current) =>
                    current.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, sku: event.target.value } : row,
                    ),
                  )
                }
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-field">
              <Label htmlFor={`po-name-${String(index)}`}>Name</Label>
              <Input
                id={`po-name-${String(index)}`}
                value={line.name}
                onChange={(event) =>
                  setLines((current) =>
                    current.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, name: event.target.value } : row,
                    ),
                  )
                }
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-field">
              <Label htmlFor={`po-qty-${String(index)}`}>Qty</Label>
              <Input
                id={`po-qty-${String(index)}`}
                type="number"
                min={1}
                step={1}
                value={line.qty}
                onChange={(event) =>
                  setLines((current) =>
                    current.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, qty: event.target.value } : row,
                    ),
                  )
                }
              />
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          onClick={() => setLines((current) => [...current, emptyLine()])}
        >
          Add line
        </Button>
      </fieldset>

      {error !== null ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice !== null ? <p className="page-description">{notice}</p> : null}

      <Button type="submit" disabled={create.isPending || suppliers.length === 0}>
        Create draft PO
      </Button>
    </form>
  );
}
