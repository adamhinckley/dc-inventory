/** A2: due date = invoice date + days parsed from customer terms (e.g. Net 30). */
export function computeDueDateFromTerms(postedAt: Date, terms: string): Date {
  const match = terms.trim().match(/net\s+(\d+)/i);
  const days = match ? Number.parseInt(match[1]!, 10) : 0;
  const due = new Date(postedAt.getTime());
  due.setUTCDate(due.getUTCDate() + days);
  return due;
}
