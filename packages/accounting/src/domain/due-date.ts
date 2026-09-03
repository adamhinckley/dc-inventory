/** A2: due date = invoice date + days parsed from customer terms (e.g. Net 30). */
export function computeDueDateFromTerms(postedAt: Date, terms: string): Date | null {
  const match = terms.trim().match(/net\s+(\d+)/i);
  if (match === null) {
    return null;
  }
  const days = Number.parseInt(match[1]!, 10);
  if (!Number.isFinite(days) || days < 0) {
    return null;
  }
  const due = new Date(postedAt.getTime());
  due.setUTCDate(due.getUTCDate() + days);
  return due;
}
