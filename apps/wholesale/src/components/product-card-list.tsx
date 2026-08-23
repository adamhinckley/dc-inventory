"use client";

import { useListWholesaleCatalog } from "@dc-inventory/api-client-wholesale";
import { ProductCard } from "./product-card";

export function ProductCardList() {
  const catalog = useListWholesaleCatalog();

  if (catalog.isPending) {
    return <p className="text-ink-muted">Loading catalog…</p>;
  }

  const payload = catalog.data?.data;
  if (catalog.isError || !payload || !("items" in payload)) {
    return (
      <p className="text-sold-out" role="alert">
        Catalog is unavailable. Start the API with `pnpm dev:api` and reload.
      </p>
    );
  }

  const items = payload.items;

  if (items.length === 0) {
    return <p className="text-ink-muted">No products in the catalog yet.</p>;
  }

  return (
    <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((product) => (
        <li key={product.id}>
          <ProductCard
            id={product.id}
            name={product.name}
            imageUrl={product.imageUrl}
            wholesalePrice={product.wholesalePrice}
            currency={product.currency}
            available={product.available}
          />
        </li>
      ))}
    </ul>
  );
}
