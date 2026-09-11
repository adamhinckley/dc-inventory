import Link from "next/link";
import { OrderHistoryPrototypeBanner } from "../../../../components/prototype/order-history-prototype-banner";
import { ShopPage } from "../../../../components/shop-page";
import {
  PROTOTYPE_ORDER_VARIANTS,
  PROTOTYPE_VARIANT_COPY,
  prototypeOrdersPath,
} from "../../../../lib/prototype/order-history-fixtures";

export default function OrderHistoryPrototypeIndexPage() {
  return (
    <ShopPage>
      <section className="flex flex-col gap-8">
        <header className="max-w-2xl">
          <p className="section-title">Orders</p>
          <h1 className="page-title mt-2">History Layouts</h1>
          <p className="mt-3 text-ink-muted">
            Three mock layouts for the same three orders. Pick one, or mix pieces, on ADA-405.
          </p>
        </header>
        <OrderHistoryPrototypeBanner />
        <ul className="grid gap-4 md:grid-cols-3">
          {PROTOTYPE_ORDER_VARIANTS.map((variant) => (
            <li key={variant}>
              <Link
                href={prototypeOrdersPath(variant)}
                className="flex h-full flex-col gap-3 rounded-2xl border border-line bg-card p-5 hover:border-line-strong"
              >
                <h2 className="text-lg font-semibold text-ink">
                  {PROTOTYPE_VARIANT_COPY[variant].title}
                </h2>
                <p className="text-sm text-ink-muted">{PROTOTYPE_VARIANT_COPY[variant].blurb}</p>
                <span className="mt-auto text-sm font-semibold text-accent">Open layout</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </ShopPage>
  );
}
