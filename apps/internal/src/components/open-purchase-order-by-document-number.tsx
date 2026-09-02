"use client";

import { getInternalPurchaseOrderByDocumentNumber } from "@dc-inventory/api-client-internal";
import { Button, FieldRow, Input, Label, LabeledField } from "@dc-inventory/ui";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function OpenPurchaseOrderByDocumentNumber() {
  const router = useRouter();
  const [documentNumber, setDocumentNumber] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = documentNumber.trim();
    if (!trimmed) {
      return;
    }

    setLoading(true);
    setNotFound(false);
    try {
      const result = await getInternalPurchaseOrderByDocumentNumber(trimmed);
      if (result.status === 200) {
        router.push(`/purchasing/${result.data.id}`);
        return;
      }
      setNotFound(true);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mt-region">
      <FieldRow>
        <LabeledField className="min-w-56 flex-1">
          <Label htmlFor="open-po-document-number">Open by PO #</Label>
          <Input
            id="open-po-document-number"
            value={documentNumber}
            onChange={(event) => {
              setDocumentNumber(event.target.value);
              setNotFound(false);
            }}
            placeholder="PO-00012"
            disabled={loading}
          />
        </LabeledField>
        <Button type="submit" variant="primary" disabled={loading || !documentNumber.trim()}>
          {loading ? "Opening…" : "Open"}
        </Button>
      </FieldRow>
      {notFound ? (
        <p className="text-body-sm text-error mt-field" role="alert">
          No purchase order found for that document number.
        </p>
      ) : null}
    </form>
  );
}
