import Link from "next/link";
import { formatMoneyMinorUnits } from "../lib/format-money";
import { shopAvailabilityLabel, type ShopSellState } from "../lib/shop-availability";

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
      <Link href={`/products/${id}`} className="flex h-full flex-col">
        <div className="flex aspect-[4/3] items-center justify-center bg-canvas text-sm text-ink-muted">
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
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <h2 className="text-lg font-semibold leading-snug text-ink">{name}</h2>
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
      </Link>
    </article>
  );
}
