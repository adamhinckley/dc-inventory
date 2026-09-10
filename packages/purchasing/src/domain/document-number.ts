import { parsePoPrefix } from "./supplier.js";

const DOCUMENT_PREFIX = "PO-";

export function formatDocumentNumber(poPrefix: string, sequence: number): string {
  return `${DOCUMENT_PREFIX}${poPrefix}-${String(sequence).padStart(5, "0")}`;
}

/** Stable 4-character stand-in when a supplier has no PO prefix. */
export function fallbackDocumentPoPrefix(supplierId: string): string {
  const hex = supplierId.replace(/-/g, "").slice(-4).toUpperCase();
  if (hex.length < 2) {
    return "XX";
  }
  return hex;
}

export function resolveDocumentPoPrefix(
  poPrefix: string | null | undefined,
  supplierId: string,
): string {
  const parsed = parsePoPrefix(poPrefix);
  if (parsed !== null && parsed !== "invalid") {
    return parsed;
  }
  return fallbackDocumentPoPrefix(supplierId);
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
