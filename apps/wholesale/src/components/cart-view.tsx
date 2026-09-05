"use client";

import {
  getListWholesaleSalesOrdersQueryKey,
  useListWholesaleSalesOrders,
  useReplaceWholesaleSalesOrderLines,
} from "@dc-inventory/api-client-wholesale";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { parseCartQty, remainingDraftLines, toReplaceLines } from "../lib/cart-line-qty";
import { lookupWholesaleProductId } from "../lib/lookup-wholesale-product-id";
import { formatMoneyMinorUnits } from "../lib/format-money";
import { wholesaleDraftCartParams } from "../lib/wholesale-draft-cart";

function lineSubtotalCents(qty: number, unitPriceCents: number): number {
  return qty * unitPriceCents;
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 3a1 1 0 0 0-1 1v1H5a1 1 0 0 0 0 2h.1l1.1 12.1A2 2 0 0 0 8.2 21h7.6a2 2 0 0 0 2-1.9L18.9 7H19a1 1 0 1 0 0-2h-3V4a1 1 0 0 0-1-1H9Zm2 2h2v1h-2V5Zm-1.9 4 .8 9h1.9l-.8-9H9.1Zm4.1 0 .8 9h1.9l-.8-9H13.2Z"
      />
    </svg>
  );
}

type DraftLine = {
  id: string;
  productId?: string;
  sku: string;
  name: string;
  qty: number;
  unitPriceCents: number;
  currency: string;
};

export function CartView() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const cart = useListWholesaleSalesOrders(wholesaleDraftCartParams);
  const replaceLines = useReplaceWholesaleSalesOrderLines();
  const qtyDialogRef = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [removingLineId, setRemovingLineId] = useState<string | null>(null);
  const [editingLine, setEditingLine] = useState<DraftLine | null>(null);
  const [qtyInput, setQtyInput] = useState("1");

  useEffect(() => {
    const dialog = qtyDialogRef.current;
    if (dialog === null) {
      return;
    }
    if (editingLine !== null) {
      if (!dialog.open) {
        dialog.showModal();
      }
      return;
    }
    if (dialog.open) {
      dialog.close();
    }
  }, [editingLine]);

  if (cart.isPending) {
    return <p className="text-ink-muted">Loading cart…</p>;
  }

  const payload = cart.data?.data;
  if (cart.isError || !payload || !("items" in payload)) {
    return (
      <p className="text-sold-out" role="alert">
        Cart is unavailable. Start the API with `pnpm dev:api` and reload.
      </p>
    );
  }

  const draft = payload.items[0];
  if (draft === undefined || draft.lines.length === 0) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-8">
        <p className="text-ink-muted">Your cart is empty.</p>
        <Link
          href="/products"
          className="inline-flex w-fit rounded-full border border-line bg-card px-5 py-2.5 text-sm font-semibold text-ink hover:bg-canvas"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  const draftId = draft.id;
  const draftLines = draft.lines;
  const currency = draftLines[0]?.currency ?? "USD";
  const subtotalCents = draftLines.reduce(
    (sum, line) => sum + lineSubtotalCents(line.qty, line.unitPriceCents),
    0,
  );
  const pending = replaceLines.isPending;

  function invalidateCart() {
    return queryClient.invalidateQueries({
      queryKey: getListWholesaleSalesOrdersQueryKey(),
    });
  }

  function openQtyEditor(line: DraftLine) {
    setMessage(null);
    setQtyInput(String(line.qty));
    setEditingLine(line);
  }

  async function persistLines(
    lines: Awaited<ReturnType<typeof toReplaceLines>>,
    failMessage: string,
    onSettled: () => void,
  ) {
    if (lines === null) {
      onSettled();
      setMessage(failMessage);
      return;
    }
    replaceLines.mutate(
      { id: draftId, data: { lines } },
      {
        onSuccess: async () => {
          await invalidateCart();
          onSettled();
        },
        onError: () => {
          onSettled();
          setMessage(failMessage);
        },
      },
    );
  }

  async function removeLine(lineId: string) {
    setMessage(null);
    setRemovingLineId(lineId);
    const remaining = remainingDraftLines(draftLines, lineId);
    const lines = await toReplaceLines(remaining, lookupWholesaleProductId);
    await persistLines(lines, "Could not remove item", () => {
      setRemovingLineId(null);
    });
  }

  async function saveEditedQty() {
    if (editingLine === null) {
      return;
    }
    const qty = parseCartQty(qtyInput);
    if (qty === null || qty < 1) {
      setMessage("Enter a quantity of 1 or more");
      return;
    }
    setMessage(null);
    const next = draftLines.map((line) =>
      line.id === editingLine.id ? { ...line, qty } : line,
    );
    const lines = await toReplaceLines(next, lookupWholesaleProductId);
    await persistLines(lines, "Could not update item", () => {
      setEditingLine(null);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <ul className="divide-y divide-line">
          {draftLines.map((line) => (
            <li
              key={line.id}
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold text-ink">{line.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <p className="text-ink-muted">Qty {line.qty}</p>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => openQtyEditor(line)}
                    className="cursor-pointer font-semibold text-accent hover:text-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Edit
                  </button>
                  {line.productId !== undefined ? (
                    <Link
                      href={`/products/${line.productId}`}
                      className="font-semibold text-accent hover:text-accent-hover"
                    >
                      Details
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        void (async () => {
                          setMessage(null);
                          const productId = await lookupWholesaleProductId(
                            line.sku,
                            line.name,
                          );
                          if (productId === null) {
                            setMessage("Product details unavailable");
                            return;
                          }
                          router.push(`/products/${productId}`);
                        })();
                      }}
                      className="cursor-pointer font-semibold text-accent hover:text-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Details
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-base font-medium text-ink">
                  {formatMoneyMinorUnits(
                    lineSubtotalCents(line.qty, line.unitPriceCents),
                    line.currency,
                  )}
                </p>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => removeLine(line.id)}
                  className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-line bg-card text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="sr-only">
                    {removingLineId === line.id ? "Removing" : "Remove"}
                  </span>
                  <TrashIcon />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <p className="min-h-5 text-sm leading-5 text-ink-muted" role="status" aria-live="polite">
        {message ?? "\u00a0"}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-card px-5 py-4">
        <p className="text-sm text-ink-muted">Draft {draft.documentNumber}</p>
        <p className="text-lg font-semibold text-ink">
          Subtotal {formatMoneyMinorUnits(subtotalCents, currency)}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/products"
          className="inline-flex rounded-full border border-line bg-card px-5 py-2.5 text-sm font-semibold text-ink hover:bg-canvas"
        >
          Continue Shopping
        </Link>
        <Link
          href="/checkout"
          className="inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink hover:opacity-90"
        >
          Checkout
        </Link>
      </div>
      <dialog
        ref={qtyDialogRef}
        className="shop-dialog w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-overlay p-6 text-ink shadow-sm"
        onClose={() => {
          setEditingLine(null);
        }}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void saveEditedQty();
          }}
        >
          <header>
            <h2 className="text-lg font-semibold text-ink">Edit Quantity</h2>
            <p className="mt-1 text-sm text-ink-muted">{editingLine?.name}</p>
          </header>
          <label className="flex flex-col gap-2 text-sm font-semibold text-ink">
            Quantity
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={qtyInput}
              disabled={pending}
              onChange={(event) => {
                setQtyInput(event.target.value);
              }}
              className="shop-input font-normal tabular-nums"
            />
          </label>
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setEditingLine(null);
              }}
              className="shop-button-secondary cursor-pointer px-5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="shop-button-primary cursor-pointer px-5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save Quantity"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
