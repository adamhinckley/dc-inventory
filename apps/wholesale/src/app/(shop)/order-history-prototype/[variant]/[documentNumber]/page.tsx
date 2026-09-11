import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderHistoryPrototypeBanner } from "../../../../../components/prototype/order-history-prototype-banner";
import { OrderHistoryVariantADetail } from "../../../../../components/prototype/order-history-variant-a";
import { OrderHistoryVariantBDetail } from "../../../../../components/prototype/order-history-variant-b";
import { OrderHistoryVariantC } from "../../../../../components/prototype/order-history-variant-c";
import { ShopPage } from "../../../../../components/shop-page";
import {
  findPrototypeOrder,
  isPrototypeOrderVariant,
  prototypeOrdersPath,
} from "../../../../../lib/prototype/order-history-fixtures";

export default async function OrderHistoryPrototypeDetailPage({
  params,
}: {
  params: Promise<{ variant: string; documentNumber: string }>;
}) {
  const { variant, documentNumber } = await params;
  if (!isPrototypeOrderVariant(variant)) {
    notFound();
  }
  const order = findPrototypeOrder(decodeURIComponent(documentNumber));
  if (order === undefined) {
    return (
      <ShopPage>
        <div className="flex flex-col items-start gap-4">
          <p className="text-sold-out" role="alert">
            This prototype order is not in the mock set.
          </p>
          <Link
            href={prototypeOrdersPath(variant)}
            className="shop-button-secondary inline-flex items-center text-sm"
          >
            Back to Prototype
          </Link>
        </div>
      </ShopPage>
    );
  }

  return (
    <ShopPage>
      <section className="flex flex-col gap-8">
        <OrderHistoryPrototypeBanner variant={variant} />
        {variant === "a" ? <OrderHistoryVariantADetail order={order} /> : null}
        {variant === "b" ? <OrderHistoryVariantBDetail order={order} /> : null}
        {variant === "c" ? (
          <OrderHistoryVariantC initialDocumentNumber={order.documentNumber} />
        ) : null}
      </section>
    </ShopPage>
  );
}
