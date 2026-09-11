import Link from "next/link";
import {
  isPrototypeOrderVariant,
  PROTOTYPE_ORDER_VARIANTS,
  PROTOTYPE_VARIANT_COPY,
  prototypeOrdersPath,
  type PrototypeOrderVariant,
} from "../../lib/prototype/order-history-fixtures";

export function OrderHistoryPrototypeBanner({
  variant,
}: {
  variant?: PrototypeOrderVariant;
}) {
  return (
    <div className="rounded-2xl border border-line bg-canvas-muted px-5 py-4">
      <p className="section-title">Prototype</p>
      <p className="mt-2 text-sm text-ink-muted">
        Mock orders only. Live history stays on{" "}
        <Link href="/orders" className="font-semibold text-accent hover:text-accent-hover">
          /orders
        </Link>
        . React on{" "}
        <a
          href="https://linear.app/adamhinckley/issue/ADA-405/prototype-wholesale-order-history-list-and-detail-layouts"
          className="font-semibold text-accent hover:text-accent-hover"
        >
          ADA-405
        </a>
        .
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={prototypeOrdersPath()}
          className={
            variant === undefined
              ? "shop-button-primary inline-flex items-center px-4 text-sm"
              : "shop-button-secondary inline-flex items-center px-4 text-sm"
          }
        >
          Overview
        </Link>
        {PROTOTYPE_ORDER_VARIANTS.map((key) => (
          <Link
            key={key}
            href={prototypeOrdersPath(key)}
            className={
              variant === key
                ? "shop-button-primary inline-flex items-center px-4 text-sm"
                : "shop-button-secondary inline-flex items-center px-4 text-sm"
            }
          >
            {PROTOTYPE_VARIANT_COPY[key].title}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function parsePrototypeVariant(value: string): PrototypeOrderVariant | null {
  return isPrototypeOrderVariant(value) ? value : null;
}
