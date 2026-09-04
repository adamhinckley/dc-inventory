"use client";

import {
  getGetWholesaleSessionQueryKey,
  getListActingCustomersQueryKey,
  useClearActingCustomer,
  useGetWholesaleSession,
  useListActingCustomers,
} from "@dc-inventory/api-client-wholesale";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ActingBanner() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useGetWholesaleSession({
    query: {
      queryKey: getGetWholesaleSessionQueryKey(),
      retry: false,
    },
  });
  const clearCustomer = useClearActingCustomer();
  const [clearError, setClearError] = useState<string | null>(null);

  const isStaffActingWithCustomer =
    session.data?.status === 200 &&
    session.data.data.mode === "staff_acting" &&
    session.data.data.customerId !== null;

  const customers = useListActingCustomers({
    query: {
      queryKey: getListActingCustomersQueryKey(),
      enabled: isStaffActingWithCustomer,
      retry: false,
    },
  });

  if (session.data?.status !== 200) {
    return null;
  }

  const sessionBody = session.data.data;
  if (sessionBody.mode !== "staff_acting" || sessionBody.customerId === null) {
    return null;
  }

  const customerId = sessionBody.customerId;
  const businessName =
    customers.data?.status === 200
      ? customers.data.data.items.find((item) => item.customerId === customerId)
          ?.businessName
      : undefined;

  function renderCustomerName() {
    if (customers.isLoading) {
      return <span className="font-semibold text-ink-muted">Loading…</span>;
    }
    if (customers.isError) {
      return (
        <span className="font-semibold text-sold-out">Name unavailable</span>
      );
    }
    if (businessName) {
      return <span className="font-semibold">{businessName}</span>;
    }
    return (
      <span className="font-semibold text-ink-muted">Account not found</span>
    );
  }

  function changeCustomer() {
    setClearError(null);
    clearCustomer.mutate(undefined, {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getGetWholesaleSessionQueryKey(),
        });
        router.push("/select-customer");
      },
      onError: () => {
        setClearError("Could not change customer.");
      },
    });
  }

  return (
    <div
      className="border-b border-line bg-canvas-muted"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-[var(--max-width-content)] flex-wrap items-center justify-between gap-3 px-6 py-3 text-sm">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-ink">
            Ordering as {renderCustomerName()}
          </p>
          {clearError !== null ? (
            <p className="text-sold-out" role="alert">
              {clearError}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="font-medium text-accent hover:text-accent-hover"
          onClick={changeCustomer}
          disabled={clearCustomer.isPending}
        >
          Change customer
        </button>
      </div>
    </div>
  );
}
