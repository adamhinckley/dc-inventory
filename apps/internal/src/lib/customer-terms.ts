export const CUSTOMER_TERMS = ["Net 30", "Net 60", "Net 90"] as const;

export type CustomerTerms = (typeof CUSTOMER_TERMS)[number];

export const CUSTOMER_TERMS_OPTIONS: ReadonlyArray<{
  value: CustomerTerms;
  label: string;
}> = CUSTOMER_TERMS.map((value) => ({ value, label: value }));

export function customerTermsSelectOptions(currentTerms?: string): ReadonlyArray<{
  value: string;
  label: string;
}> {
  const trimmed = currentTerms?.trim() ?? "";
  if (trimmed.length === 0 || CUSTOMER_TERMS.includes(trimmed as CustomerTerms)) {
    return CUSTOMER_TERMS_OPTIONS;
  }
  return [...CUSTOMER_TERMS_OPTIONS, { value: trimmed, label: trimmed }];
}
