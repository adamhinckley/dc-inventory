import Link from "next/link";
import { formatMoneyMinorUnits } from "../lib/format-money";
import { productImageIsPlaceholder, productImageSrc } from "../lib/product-image";
import { shopDisplayAvailableQty, type ShopSellState } from "../lib/shop-availability";

export type ProductCardProps = {
  id: string;
  sku: string;
  name: string;
  imageUrl: string | null;
  wholesalePrice: number;
  currency: string;
  available: number;
  availableToSell: number | null;
  sellState: ShopSellState;
  /** Carried onto the PDP so its breadcrumb can point back at the category. */
  fromCategory?: string;
};

export function productDetailHref(id: string, fromCategory?: string): string {
  return fromCategory === undefined
    ? `/products/${id}`
    : `/products/${id}?category=${encodeURIComponent(fromCategory)}`;
}

/** Overlaid pill: nothing for open SKUs, "N left" for locked with stock, "Sold out" otherwise. */
export function availabilityPill(input: {
  available: number;
  availableToSell: number | null;
  sellState: ShopSellState;
}): { label: string; tone: "muted" | "sold-out" } | null {
  if (input.sellState === "open") {
    return null;
  }
  const qty = shopDisplayAvailableQty(input);
  if (qty === null) {
    return { label: "Sold out", tone: "sold-out" };
  }
  return { label: `${qty.toLocaleString()} left`, tone: "muted" };
}

export function ProductCard({
  id,
  sku,
  name,
  imageUrl,
  wholesalePrice,
  currency,
  available,
  availableToSell,
  sellState,
  fromCategory,
}: ProductCardProps) {
  const pill = availabilityPill({ available, availableToSell, sellState });
  const href = productDetailHref(id, fromCategory);

  return (
    <article className="product-card group flex h-full flex-col">
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden="true"
        className="product-card-image relative block aspect-square overflow-hidden rounded-xl bg-canvas-muted"
      >
        {/* Catalog image URLs come from the API; next/image host allowlist is later. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={productImageSrc(imageUrl)}
          alt=""
          loading="lazy"
          className={
            productImageIsPlaceholder(imageUrl)
              ? "h-full w-full object-contain"
              : "h-full w-full object-cover"
          }
        />
        {pill !== null ? (
          <span
            className={`absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] ${
              pill.tone === "sold-out"
                ? "bg-sold-out text-on-accent"
                : "bg-overlay/95 text-ink shadow-sm"
            }`}
          >
            {pill.label}
          </span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col gap-1 pt-3">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          {sku}
        </p>
        <h2 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-5 text-ink">
          <Link
            href={href}
            className="hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {name}
          </Link>
        </h2>
        <p className="text-sm tabular-nums text-ink">
          {formatMoneyMinorUnits(wholesalePrice, currency)}
        </p>
      </div>
    </article>
  );
}
