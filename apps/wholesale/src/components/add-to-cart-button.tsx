"use client";

import {
  getListWholesaleSalesOrdersQueryKey,
  useCreateWholesaleSalesOrder,
} from "@dc-inventory/api-client-wholesale";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export type AddToCartButtonProps = {
  productId: string;
  disabled?: boolean;
};

export function AddToCartButton({ productId, disabled = false }: AddToCartButtonProps) {
  const queryClient = useQueryClient();
  const createOrder = useCreateWholesaleSalesOrder();
  const [message, setMessage] = useState<string | null>(null);

  function addToCart() {
    setMessage(null);
    createOrder.mutate(
      { data: { lines: [{ productId, qty: 1 }] } },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({
            queryKey: getListWholesaleSalesOrdersQueryKey(),
          });
          setMessage("Added to cart");
        },
        onError: () => {
          setMessage("Could not add to cart");
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={disabled || createOrder.isPending}
        onClick={addToCart}
        className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {createOrder.isPending ? "Adding…" : "Add to Cart"}
      </button>
      {message ? (
        <p className="text-sm text-ink-muted" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
