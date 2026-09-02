"use client";

import { getInternalPurchaseOrderByDocumentNumber } from "@dc-inventory/api-client-internal";
import { Label, LabeledField, TextInput } from "@dc-inventory/ui";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function OpenPurchaseOrderByDocumentNumber() {
  const router = useRouter();
  const [documentNumber, setDocumentNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = documentNumber.trim();
    if (!trimmed || loading) {
      return;
    }

    setLoading(true);
    try {
      const result = await getInternalPurchaseOrderByDocumentNumber(trimmed);
      if (result.status === 200) {
        router.push(`/purchasing/${result.data.id}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mt-region">
      <LabeledField className="w-52">
        <Label htmlFor="open-po-document-number">Open by PO #</Label>
        <TextInput
          id="open-po-document-number"
          density="compact"
          className="w-52"
          value={documentNumber}
          onChange={setDocumentNumber}
          placeholder="PO-00012"
          disabled={loading}
        />
      </LabeledField>
    </form>
  );
}
