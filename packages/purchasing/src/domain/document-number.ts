import { parsePoPrefix } from "./supplier.js";

const DOCUMENT_PREFIX = "PO-";
const FALLBACK_PREFIX_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function formatDocumentNumber(poPrefix: string, sequence: number): string {
  return `${DOCUMENT_PREFIX}${poPrefix}-${String(sequence).padStart(5, "0")}`;
}

function hashSupplierId(supplierId: string, attempt: number): number {
  const normalized = supplierId.replace(/-/g, "").toLowerCase();
  let hash = attempt >>> 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  return hash;
}

/** Stable 4-character stand-in when a supplier has no PO prefix. */
export function fallbackDocumentPoPrefix(supplierId: string, attempt = 0): string {
  let value = hashSupplierId(supplierId, attempt);
  let result = "";
  for (let index = 0; index < 4; index += 1) {
    result = FALLBACK_PREFIX_CHARS[value % 36]! + result;
    value = Math.floor(value / 36);
  }
  return result;
}

export function pickUniqueFallbackDocumentPoPrefix(
  supplierId: string,
  occupiedDocumentPrefixes: ReadonlySet<string>,
): string {
  for (let attempt = 0; attempt < 256; attempt += 1) {
    const candidate = fallbackDocumentPoPrefix(supplierId, attempt);
    if (!occupiedDocumentPrefixes.has(candidate)) {
      return candidate;
    }
  }
  throw new Error("Could not allocate unique fallback PO prefix");
}

export function collectOccupiedDocumentPrefixes(
  suppliers: readonly { id: string; poPrefix: string | null | undefined }[],
  excludeSupplierId?: string,
): Set<string> {
  const occupied = new Set<string>();
  const withoutPrefix: string[] = [];

  for (const supplier of suppliers) {
    if (supplier.id === excludeSupplierId) {
      continue;
    }
    const parsed = parsePoPrefix(supplier.poPrefix);
    if (parsed !== null && parsed !== "invalid") {
      occupied.add(parsed);
      continue;
    }
    withoutPrefix.push(supplier.id);
  }

  withoutPrefix.sort();
  for (const supplierId of withoutPrefix) {
    occupied.add(pickUniqueFallbackDocumentPoPrefix(supplierId, occupied));
  }

  return occupied;
}

export function resolveDocumentPoPrefix(
  poPrefix: string | null | undefined,
  supplierId: string,
  occupiedDocumentPrefixes: ReadonlySet<string> = new Set(),
): string {
  const parsed = parsePoPrefix(poPrefix);
  if (parsed !== null && parsed !== "invalid") {
    return parsed;
  }
  return pickUniqueFallbackDocumentPoPrefix(supplierId, occupiedDocumentPrefixes);
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
