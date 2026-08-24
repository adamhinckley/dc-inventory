const DOCUMENT_PREFIX = "SO-";

export function formatDocumentNumber(sequence: number): string {
  return `${DOCUMENT_PREFIX}${String(sequence).padStart(5, "0")}`;
}

export function parseDocumentSequence(documentNumber: string): number | null {
  if (!documentNumber.startsWith(DOCUMENT_PREFIX)) {
    return null;
  }
  const parsed = Number.parseInt(documentNumber.slice(DOCUMENT_PREFIX.length), 10);
  return Number.isFinite(parsed) ? parsed : null;
}
