import { notFound } from "next/navigation";
import { OrderHistoryPrototypeBanner } from "../../../../components/prototype/order-history-prototype-banner";
import { OrderHistoryVariantAList } from "../../../../components/prototype/order-history-variant-a";
import { OrderHistoryVariantBList } from "../../../../components/prototype/order-history-variant-b";
import { OrderHistoryVariantC } from "../../../../components/prototype/order-history-variant-c";
import { ShopPage } from "../../../../components/shop-page";
import {
  isPrototypeOrderVariant,
  PROTOTYPE_VARIANT_COPY,
} from "../../../../lib/prototype/order-history-fixtures";

export default async function OrderHistoryPrototypeVariantPage({
  params,
}: {
  params: Promise<{ variant: string }>;
}) {
  const { variant } = await params;
  if (!isPrototypeOrderVariant(variant)) {
    notFound();
  }

  return (
    <ShopPage>
      <section className="flex flex-col gap-8">
        <header className="max-w-2xl">
          <p className="section-title">Orders</p>
          <h1 className="page-title mt-2">{PROTOTYPE_VARIANT_COPY[variant].title}</h1>
          <p className="mt-3 text-ink-muted">{PROTOTYPE_VARIANT_COPY[variant].blurb}</p>
        </header>
        <OrderHistoryPrototypeBanner variant={variant} />
        {variant === "a" ? <OrderHistoryVariantAList /> : null}
        {variant === "b" ? <OrderHistoryVariantBList /> : null}
        {variant === "c" ? <OrderHistoryVariantC /> : null}
      </section>
    </ShopPage>
  );
}
