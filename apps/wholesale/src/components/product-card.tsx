import Link from "next/link";
import { formatMoneyMinorUnits } from "../lib/format-money";
import { shopAvailabilityLabel, type ShopSellState } from "../lib/shop-availability";
import { AddToCartButton } from "./add-to-cart-button";

export type ProductCardProps = {
  id: string;
  name: string;
  imageUrl: string | null;
  wholesalePrice: number;
  currency: string;
  available: number;
  availableToSell: number | null;
  sellState: ShopSellState;
};

export function ProductCard({
  id,
  name,
  imageUrl,
  wholesalePrice,
  currency,
  available,
  availableToSell,
  sellState,
}: ProductCardProps) {
  const { inStock, label } = shopAvailabilityLabel({
    available,
    availableToSell,
    sellState,
  });

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-1 flex-col">
        <Link
          href={`/products/${id}`}
          tabIndex={-1}
          className="flex aspect-[4/3] items-center justify-center bg-canvas text-sm text-ink-muted outline-none"
        >
          {imageUrl ? (
            // Catalog image URLs come from the API; next/image host allowlist is later.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span>No image</span>
          )}
        </Link>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <h2 className="text-lg font-semibold leading-snug">
            <Link
              href={`/products/${id}`}
              className="text-ink hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {name}
            </Link>
          </h2>
          <p className="text-base text-ink">
            {formatMoneyMinorUnits(wholesalePrice, currency)}
            <span className="ml-1 text-sm font-normal text-ink-muted">
              wholesale
            </span>
          </p>
          <p
            className={`mt-auto text-sm ${inStock ? "text-ink-muted" : "text-sold-out"}`}
          >
            {label}
          </p>
        </div>
      </div>
      <div className="p-4 pt-0">
        <AddToCartButton
          productId={id}
          name={name}
          unitPriceCents={wholesalePrice}
          currency={currency}
          disabled={!inStock}
          available={available}
          availableToSell={availableToSell}
          sellState={sellState}
        />
      </div>
    </article>
  );
}
