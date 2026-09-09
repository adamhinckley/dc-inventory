"use client";

import {
  getGetWholesaleCatalogProductQueryKey,
  useGetWholesaleCatalogProduct,
} from "@dc-inventory/api-client-wholesale";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  cartCurrency,
  cartDisplayName,
  cartLineCount,
  cartSubtotalCents,
} from "../lib/active-cart";
import { cartQtyCapMessage, cartQtyOverCap, parseCartQty } from "../lib/cart-line-qty";
import { formatMoneyMinorUnits } from "../lib/format-money";
import { lookupWholesaleProductId } from "../lib/lookup-wholesale-product-id";
import { PRODUCT_PLACEHOLDER_SRC } from "../lib/product-image";
import { shopDisplayAvailableQty } from "../lib/shop-availability";
import { useActiveCart } from "../lib/use-active-cart";
import { flushCartPendingChanges } from "../lib/cart-mutation-gate";
import { useCartActions } from "../lib/use-cart-actions";

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

function CartQtyForm({
  productId,
  name,
  qtyInput,
  pending,
  onQtyInput,
  onCancel,
  onSave,
}: {
  productId?: string;
  name: string;
  qtyInput: string;
  pending: boolean;
  onQtyInput: (raw: string) => void;
  onCancel: () => void;
  onSave: (maxQty: number | null) => void;
}) {
  const [capMessage, setCapMessage] = useState<string | null>(null);
  const resolvedProductId = productId ?? "";
  const product = useGetWholesaleCatalogProduct(resolvedProductId, {
    query: {
      enabled: productId !== undefined,
      queryKey: getGetWholesaleCatalogProductQueryKey(resolvedProductId),
    },
  });
  const payload =
    product.data?.data !== undefined && "id" in product.data.data ? product.data.data : undefined;
  const maxQty = payload === undefined ? null : shopDisplayAvailableQty(payload);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const qty = parseCartQty(qtyInput);
        if (qty !== null && maxQty !== null && cartQtyOverCap(qty, maxQty)) {
          setCapMessage(cartQtyCapMessage(maxQty));
          return;
        }
        setCapMessage(null);
        onSave(maxQty);
      }}
    >
      <header>
        <h2 className="text-lg font-semibold text-ink">Edit Quantity</h2>
        <p className="mt-1 text-sm text-ink-muted">{name}</p>
      </header>
      <label className="flex flex-col gap-2 text-sm font-semibold text-ink">
        Quantity
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={maxQty ?? undefined}
          step={1}
          value={qtyInput}
          disabled={pending}
          onChange={(event) => {
            const raw = event.target.value;
            const parsed = parseCartQty(raw);
            if (parsed !== null && maxQty !== null && cartQtyOverCap(parsed, maxQty)) {
              onQtyInput(String(maxQty));
              setCapMessage(cartQtyCapMessage(maxQty));
              return;
            }
            setCapMessage(null);
            onQtyInput(raw);
          }}
          className="shop-input font-normal tabular-nums"
        />
      </label>
      {capMessage !== null ? (
        <p className="text-sm text-sold-out" role="alert">
          {capMessage}
        </p>
      ) : maxQty !== null ? (
        <p className="text-sm text-ink-muted">{cartQtyCapMessage(maxQty)}</p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
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

/** /cart/[id] — one open cart: lines, rename, delete, make active, checkout. */
export function CartView({ cartId }: { cartId: string }) {
  const router = useRouter();
  const activeCart = useActiveCart();
  const draft = activeCart.drafts.find((item) => item.id === cartId);
  const actions = useCartActions(draft);
  const qtyDialogRef = useRef<HTMLDialogElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const [removingLineId, setRemovingLineId] = useState<string | null>(null);
  const [editingLine, setEditingLine] = useState<DraftLine | null>(null);
  const [qtyInput, setQtyInput] = useState("1");
  const [renaming, setRenaming] = useState(false);
  const [labelInput, setLabelInput] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [checkoutNavigating, setCheckoutNavigating] = useState(false);

  useEffect(() => {
    void flushCartPendingChanges(cartId);
  }, [cartId]);

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

  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (dialog === null) {
      return;
    }
    if (confirmingDelete && !dialog.open) {
      dialog.showModal();
    } else if (!confirmingDelete && dialog.open) {
      dialog.close();
    }
  }, [confirmingDelete]);

  if (activeCart.isPending) {
    return <p className="text-ink-muted">Loading cart…</p>;
  }

  if (activeCart.isError) {
    return (
      <p className="text-sold-out" role="alert">
        Cart is unavailable. Start the API with `pnpm dev:api` and reload.
      </p>
    );
  }

  if (draft === undefined) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-8">
        <p className="text-ink-muted">
          This cart is no longer open — it was checked out or deleted.
        </p>
        <Link
          href="/cart"
          className="shop-button-secondary inline-flex w-fit items-center px-5 text-sm"
        >
          All Carts
        </Link>
      </div>
    );
  }

  const cartDraft = draft;
  const draftLines = cartDraft.lines;
  const isActive = activeCart.activeDraft?.id === cartDraft.id;
  const pending = actions.pending;

  function openQtyEditor(line: DraftLine) {
    actions.setMessage(null);
    setQtyInput(String(line.qty));
    setEditingLine(line);
  }

  async function saveEditedQty(maxQty: number | null) {
    if (editingLine === null) {
      return;
    }
    const qty = parseCartQty(qtyInput);
    if (qty === null || qty < 1) {
      actions.setMessage("Enter a quantity of 1 or more");
      return;
    }
    if (maxQty !== null && cartQtyOverCap(qty, maxQty)) {
      actions.setMessage(cartQtyCapMessage(maxQty));
      return;
    }
    await actions.setLineQty(editingLine.id, qty);
    setEditingLine(null);
  }

  function removeLine(lineId: string) {
    setRemovingLineId(lineId);
    void actions.removeLine(lineId).finally(() => {
      setRemovingLineId((current) => (current === lineId ? null : current));
    });
  }

  async function saveLabel() {
    const ok = await actions.rename(labelInput.trim().length === 0 ? null : labelInput);
    if (ok) {
      setRenaming(false);
    }
  }

  async function deleteCart() {
    const ok = await actions.deleteCart();
    setConfirmingDelete(false);
    if (ok) {
      if (isActive) {
        activeCart.clearActiveCart();
      }
      router.push("/cart");
    }
  }

  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
            <Link href="/cart" className="hover:text-accent">
              Carts
            </Link>
            <span className="mx-2">/</span>
            <span className="text-ink">{cartDraft.documentNumber}</span>
          </nav>
          {renaming ? (
            <form
              className="mt-2 flex flex-wrap items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void saveLabel();
              }}
            >
              <label htmlFor="cart-label" className="sr-only">
                Cart name
              </label>
              <input
                id="cart-label"
                type="text"
                maxLength={80}
                autoFocus
                value={labelInput}
                disabled={pending}
                placeholder={`Cart ${cartDraft.documentNumber}`}
                onChange={(event) => setLabelInput(event.target.value)}
                className="shop-input w-72 max-w-full"
              />
              <button
                type="submit"
                disabled={pending}
                className="shop-button-primary cursor-pointer px-5 text-sm disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save Name"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setRenaming(false)}
                className="shop-button-secondary cursor-pointer px-5 text-sm"
              >
                Cancel
              </button>
            </form>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="page-title">{cartDisplayName(cartDraft)}</h1>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setLabelInput(cartDraft.label ?? "");
                  setRenaming(true);
                }}
                className="cursor-pointer text-sm font-semibold text-accent hover:text-accent-hover disabled:opacity-50"
              >
                Rename
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isActive ? (
            <span className="rounded-full bg-accent px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-on-accent">
              Active cart
            </span>
          ) : (
            <button
              type="button"
              onClick={() => activeCart.setActiveCart(cartDraft.id)}
              className="shop-button-secondary inline-flex min-h-10 cursor-pointer items-center px-4 text-sm"
            >
              Make Active
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmingDelete(true)}
            className="inline-flex min-h-10 cursor-pointer items-center rounded-full border border-line px-4 text-sm font-semibold text-sold-out hover:bg-canvas disabled:opacity-50"
          >
            Delete Cart
          </button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          <ul className="divide-y divide-line">
            {draftLines.map((line) => (
              <li key={line.id} className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-start gap-4 px-5 py-4">
                <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-canvas-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={PRODUCT_PLACEHOLDER_SRC} alt="" className="h-full w-full object-contain" />
                </div>
                <div className="min-w-0">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                    {line.sku}
                  </p>
                  <p className="font-semibold text-ink">{line.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <p className="text-ink-muted">
                      Qty {line.qty} · {formatMoneyMinorUnits(line.unitPriceCents, line.currency)} each
                    </p>
                    <button
                      type="button"
                      onClick={() => openQtyEditor(line)}
                      className="cursor-pointer font-semibold text-accent hover:text-accent-hover"
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
                          onClick={() => {
                            void (async () => {
                              actions.setMessage(null);
                              const productId = await lookupWholesaleProductId(line.sku, line.name);
                              if (productId === null) {
                                actions.setMessage("Product details unavailable");
                                return;
                              }
                              router.push(`/products/${productId}`);
                            })();
                          }}
                          className="cursor-pointer font-semibold text-accent hover:text-accent-hover"
                        >
                        Details
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <p className="text-right text-base font-medium tabular-nums text-ink">
                    {formatMoneyMinorUnits(line.qty * line.unitPriceCents, line.currency)}
                  </p>
                    <button
                      type="button"
                      disabled={removingLineId === line.id}
                      onClick={() => {
                        removeLine(line.id);
                      }}
                      className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-card text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
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

        <aside className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 lg:sticky lg:top-[calc(var(--space-nav-height)+1.5rem)]">
          <p className="section-title">Summary</p>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-muted">Cart</dt>
              <dd className="text-ink">{cartDraft.documentNumber}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Lines</dt>
              <dd className="tabular-nums text-ink">{cartLineCount(cartDraft)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-base">
              <dt className="font-semibold text-ink">Subtotal</dt>
              <dd className="font-semibold tabular-nums text-ink">
                {formatMoneyMinorUnits(cartSubtotalCents(cartDraft), cartCurrency(cartDraft))}
              </dd>
            </div>
          </dl>
          <p className="min-h-5 text-sm leading-5 text-ink-muted" role="status" aria-live="polite">
            {actions.message ?? "\u00a0"}
          </p>
          <button
            type="button"
            disabled={
              actions.pending ||
              actions.dirty ||
              checkoutNavigating ||
              cartDraft.lines.length === 0
            }
            onClick={() => {
              setCheckoutNavigating(true);
              void actions.flushPendingChanges().then((ok) => {
                setCheckoutNavigating(false);
                if (!ok) {
                  return;
                }
                router.push(`/checkout?cart=${cartDraft.id}`);
              });
            }}
            className="shop-button-primary inline-flex items-center justify-center text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {checkoutNavigating || actions.pending || actions.dirty
              ? "Saving…"
              : "Checkout This Cart"}
          </button>
          <Link
            href="/products"
            className="shop-button-secondary inline-flex items-center justify-center text-sm"
          >
            Continue Shopping
          </Link>
        </aside>
      </div>

      <dialog
        ref={qtyDialogRef}
        className="shop-dialog w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-overlay p-6 text-ink shadow-sm"
        onClose={() => {
          setEditingLine(null);
        }}
      >
        {editingLine !== null ? (
          <CartQtyForm
            productId={editingLine.productId}
            name={editingLine.name}
            qtyInput={qtyInput}
            pending={pending}
            onQtyInput={setQtyInput}
            onCancel={() => {
              setEditingLine(null);
            }}
            onSave={(maxQty) => {
              void saveEditedQty(maxQty);
            }}
          />
        ) : null}
      </dialog>

      <dialog
        ref={deleteDialogRef}
        className="shop-dialog w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-line bg-overlay p-6 text-ink shadow-sm"
        onClose={() => setConfirmingDelete(false)}
      >
        <h2 className="text-lg font-semibold text-ink">Delete this cart?</h2>
        <p className="mt-2 text-sm text-ink-muted">
          {cartDisplayName(cartDraft)} and its {cartLineCount(cartDraft)}{" "}
          {cartLineCount(cartDraft) === 1 ? "line" : "lines"} will be removed. Other carts stay
          open.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmingDelete(false)}
            className="shop-button-secondary cursor-pointer px-5 text-sm"
          >
            Keep Cart
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              void deleteCart();
            }}
            className="inline-flex min-h-12 cursor-pointer items-center rounded-full bg-sold-out px-5 text-sm font-semibold text-on-accent hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Deleting…" : "Delete Cart"}
          </button>
        </div>
      </dialog>
    </section>
  );
}
