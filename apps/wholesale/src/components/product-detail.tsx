"use client";

import { useGetWholesaleCatalogProduct } from "@dc-inventory/api-client-wholesale";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatMoneyMinorUnits } from "../lib/format-money";
import { productImageIsPlaceholder, productImageSrc } from "../lib/product-image";
import { shopAvailabilityLabel } from "../lib/shop-availability";
import { AddToCartButton } from "./add-to-cart-button";
import { availabilityPill } from "./product-card";

function ProductDetailSkeleton() {
  return (
    <div
      className="flex flex-col-reverse gap-8 md:grid md:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] md:items-start md:gap-10"
      aria-busy="true"
    >
      <div className="shop-skeleton mx-auto aspect-square w-full max-h-[min(28rem,calc(100dvh-var(--space-nav-height)-12rem))] max-w-[min(100%,36rem)] rounded-2xl" />
      <div className="flex flex-col gap-4">
        <div className="shop-skeleton h-3 w-24 rounded" />
        <div className="shop-skeleton h-10 w-3/4 rounded" />
        <div className="shop-skeleton h-6 w-28 rounded" />
        <div className="shop-skeleton h-12 w-full rounded-full" />
      </div>
    </div>
  );
}

/** PDP: buy box first on small screens; image + details side by side from md. */
export function ProductDetail({ productId }: { productId: string }) {
  const searchParams = useSearchParams();
  const fromCategory = searchParams.get("category");
  const product = useGetWholesaleCatalogProduct(productId);

  if (product.isPending) {
    return <ProductDetailSkeleton />;
  }

  const payload = product.data?.data;
  if (product.isError || !payload || !("id" in payload)) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-sold-out" role="alert">
          Product is unavailable or hidden from the shop.
        </p>
        <Link href="/products" className="shop-button-secondary inline-flex items-center text-sm">
          Back to Products
        </Link>
      </div>
    );
  }

  const availability = {
    available: payload.available,
    availableToSell: payload.availableToSell,
    sellState: payload.sellState,
  };
  const { inStock, label } = shopAvailabilityLabel(availability);
  const pill = availabilityPill(availability);
  const description = payload.description?.trim() ?? "";

  return (
    <article className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
        <Link href="/products" className="hover:text-accent">
          Products
        </Link>
        {fromCategory !== null && fromCategory.length > 0 ? (
          <>
            <span className="mx-2">/</span>
            <Link
              href={`/products?category=${encodeURIComponent(fromCategory)}`}
              className="hover:text-accent"
            >
              {fromCategory}
            </Link>
          </>
        ) : null}
        <span className="mx-2">/</span>
        <span className="text-ink">{payload.sku}</span>
      </nav>

      <div className="flex flex-col-reverse gap-8 md:grid md:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] md:items-start md:gap-10">
        <div className="relative mx-auto w-full max-w-[min(100%,36rem)] overflow-hidden rounded-2xl bg-canvas-muted md:sticky md:top-[calc(var(--space-nav-height)+1.5rem)]">
          <div className="aspect-square max-h-[min(28rem,calc(100dvh-var(--space-nav-height)-12rem))] w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={productImageSrc(payload.imageUrl)}
              alt={payload.name}
              className={
                productImageIsPlaceholder(payload.imageUrl)
                  ? "h-full w-full object-contain"
                  : "h-full w-full object-cover"
              }
            />
          </div>
          {pill !== null ? (
            <span
              className={`absolute left-4 top-4 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] ${
                pill.tone === "sold-out"
                  ? "bg-sold-out text-on-accent"
                  : "bg-overlay/95 text-ink shadow-sm"
              }`}
            >
              {pill.label}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-5">
          <header>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
              Item # {payload.sku}
            </p>
            <h1 className="page-title mt-2">{payload.name}</h1>
          </header>
          <p className="text-2xl font-semibold tabular-nums text-ink">
            {formatMoneyMinorUnits(payload.wholesalePrice, payload.currency)}
            <span className="ml-2 text-base font-normal text-ink-muted">wholesale</span>
          </p>
          <p className={`text-sm ${inStock ? "text-ink-muted" : "text-sold-out"}`}>{label}</p>
          <AddToCartButton
            productId={payload.id}
            name={payload.name}
            unitPriceCents={payload.wholesalePrice}
            currency={payload.currency}
            disabled={!inStock}
            available={payload.available}
            availableToSell={payload.availableToSell}
            sellState={payload.sellState}
          />
          <section className="border-t border-line pt-5">
            <h2 className="section-title">Description</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-ink-subtle">
              {description.length > 0
                ? description
                : "No description yet. Ask your rep for details on this item."}
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}
