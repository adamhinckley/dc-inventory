"use client";

import { useGetWholesaleCatalogProduct } from "@dc-inventory/api-client-wholesale";
import { formatMoneyMinorUnits } from "../lib/format-money";
import { shopAvailabilityLabel } from "../lib/shop-availability";
import { AddToCartButton } from "./add-to-cart-button";

export function ProductDetail({ productId }: { productId: string }) {
  const product = useGetWholesaleCatalogProduct(productId);

  if (product.isPending) {
    return <p className="text-ink-muted">Loading product…</p>;
  }

  const payload = product.data?.data;
  if (product.isError || !payload || !("id" in payload)) {
    return (
      <p className="text-sold-out" role="alert">
        Product is unavailable or hidden from the shop.
      </p>
    );
  }

  const { inStock, label } = shopAvailabilityLabel({
    available: payload.available,
    availableToSell: payload.availableToSell,
    sellState: payload.sellState,
  });

  return (
    <article className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border border-line bg-canvas text-sm text-ink-muted">
        {payload.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={payload.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span>No image</span>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <header>
          <p className="section-title">Product</p>
          <h1 className="page-title mt-2">{payload.name}</h1>
        </header>
        <p className="text-xl font-semibold text-ink">
          {formatMoneyMinorUnits(payload.wholesalePrice, payload.currency)}
          <span className="ml-2 text-base font-normal text-ink-muted">wholesale</span>
        </p>
        <p className={inStock ? "text-ink-muted" : "text-sold-out"}>{label}</p>
        <AddToCartButton productId={payload.id} name={payload.name} disabled={!inStock} />
      </div>
    </article>
  );
}
