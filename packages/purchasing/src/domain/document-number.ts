const DOCUMENT_PREFIX = "PO-";

export function formatDocumentNumber(poPrefix: string, sequence: number): string {
  return `${DOCUMENT_PREFIX}${poPrefix}-${String(sequence).padStart(5, "0")}`;
}

export type ParsedPurchaseOrderDocumentNumber = {
  poPrefix: string;
  sequence: number;
};

export function parseDocumentNumber(
  documentNumber: string,
): ParsedPurchaseOrderDocumentNumber | null {
  if (!documentNumber.startsWith(DOCUMENT_PREFIX)) {
    return null;
  }
  const remainder = documentNumber.slice(DOCUMENT_PREFIX.length);
  const separator = remainder.lastIndexOf("-");
  if (separator <= 0) {
    return null;
  }
  const poPrefix = remainder.slice(0, separator);
  const digits = remainder.slice(separator + 1);
  if (!/^[A-Z0-9]{2,4}$/.test(poPrefix) || !/^\d{5}$/.test(digits)) {
    return null;
  }
  const sequence = Number.parseInt(digits, 10);
  if (!Number.isFinite(sequence) || sequence < 1) {
    return null;
  }
  return { poPrefix, sequence };
}

/** Sequence only — for callers that already know the supplier prefix. */
export function parseDocumentSequence(
  documentNumber: string,
  poPrefix: string,
): number | null {
  const parsed = parseDocumentNumber(documentNumber);
  if (parsed === null || parsed.poPrefix !== poPrefix) {
    return null;
  }
  return parsed.sequence;
}
