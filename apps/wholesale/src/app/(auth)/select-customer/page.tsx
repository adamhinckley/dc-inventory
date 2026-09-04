"use client";

import {
  getGetWholesaleSessionQueryKey,
  getListActingCustomersQueryKey,
  useGetWholesaleSession,
  useListActingCustomers,
  useSelectActingCustomer,
} from "@dc-inventory/api-client-wholesale";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ShopPage } from "../../../components/shop-page";

export default function SelectCustomerPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useGetWholesaleSession({
    query: {
      queryKey: getGetWholesaleSessionQueryKey(),
      retry: false,
    },
  });
  const customers = useListActingCustomers({
    query: {
      queryKey: getListActingCustomersQueryKey(),
      enabled:
        session.data?.status === 200 && session.data.data.mode === "staff_acting",
      retry: false,
    },
  });
  const selectCustomer = useSelectActingCustomer();

  useEffect(() => {
    if (session.isLoading) {
      return;
    }
    if (session.data?.status !== 200 || session.data.data.mode !== "staff_acting") {
      router.replace("/products");
    }
  }, [router, session.data, session.isLoading]);

  function onSelect(customerId: string) {
    selectCustomer.mutate(
      { data: { customerId } },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({
            queryKey: getGetWholesaleSessionQueryKey(),
          });
          router.push("/products");
        },
      },
    );
  }

  if (session.isLoading || session.data?.status !== 200) {
    return (
      <ShopPage>
        <p className="text-ink-muted">Loading…</p>
      </ShopPage>
    );
  }

  if (session.data.data.mode !== "staff_acting") {
    return null;
  }

  const items =
    customers.data?.status === 200 ? customers.data.data.items : undefined;

  return (
    <ShopPage>
      <section className="mx-auto max-w-xl rounded-2xl border border-line bg-card p-8 shadow-sm">
        <p className="section-title">Staff</p>
        <h1 className="page-title mt-2">Select customer</h1>
        <p className="mt-4 text-sm text-ink-muted">
          Choose which wholesale account you are ordering for.
        </p>
        {customers.isLoading ? (
          <p className="mt-8 text-ink-muted">Loading customers…</p>
        ) : customers.isError ? (
          <p className="mt-8 text-sold-out" role="alert">
            Could not load customers.
          </p>
        ) : (
          <ul className="mt-8 flex flex-col gap-3">
            {items?.map((customer) => (
              <li key={customer.customerId}>
                <button
                  type="button"
                  className="shop-button-secondary w-full text-left"
                  disabled={selectCustomer.isPending}
                  onClick={() => onSelect(customer.customerId)}
                >
                  <span className="block font-semibold text-ink">
                    {customer.businessName}
                  </span>
                  <span className="mt-1 block text-sm font-normal text-ink-muted">
                    {customer.customerNumber}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </ShopPage>
  );
}
