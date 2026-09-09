export type AllocationInvoice = {
  id: string;
  documentNumber: string;
  remainingCents: number;
  dueDate: string | null;
  postedAt: string | null;
};

export function sortInvoicesOldestDueFirst(
  invoices: readonly AllocationInvoice[],
): AllocationInvoice[] {
  return [...invoices].sort((left, right) => {
    const leftDue = left.dueDate ?? "";
    const rightDue = right.dueDate ?? "";
    if (leftDue !== rightDue) {
      return leftDue < rightDue ? -1 : 1;
    }
    const leftPosted = left.postedAt ?? "";
    const rightPosted = right.postedAt ?? "";
    if (leftPosted !== rightPosted) {
      return leftPosted < rightPosted ? -1 : 1;
    }
    return 0;
  });
}

export function prefillAllocationsOldestFirst(
  amountCents: number,
  invoices: readonly AllocationInvoice[],
): Record<string, number> {
  let remaining = amountCents;
  const allocations: Record<string, number> = {};
  for (const invoice of sortInvoicesOldestDueFirst(invoices)) {
    if (remaining <= 0) {
      break;
    }
    const applied = Math.min(remaining, invoice.remainingCents);
    if (applied > 0) {
      allocations[invoice.id] = applied;
      remaining -= applied;
    }
  }
  return allocations;
}

export function mergeAllocations(
  prefill: Record<string, number>,
  overrides: Record<string, number>,
): Record<string, number> {
  return { ...prefill, ...overrides };
}

export function sumAllocations(allocations: Record<string, number>): number {
  return Object.values(allocations).reduce((sum, amount) => sum + amount, 0);
}

export type AllocationFooterState = {
  amountCents: number;
  allocatedCents: number;
  holdRemainderAsCredit: boolean;
};

export function allocationRemainderCents(state: AllocationFooterState): number {
  return state.amountCents - state.allocatedCents;
}

export function recordPaymentSubmitDisabled(state: AllocationFooterState): boolean {
  const remainder = allocationRemainderCents(state);
  if (state.amountCents <= 0) {
    return true;
  }
  if (remainder < 0) {
    return true;
  }
  if (remainder === 0) {
    return false;
  }
  return !state.holdRemainderAsCredit;
}
