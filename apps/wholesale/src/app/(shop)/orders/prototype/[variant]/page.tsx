import { redirect } from "next/navigation";
import { isPrototypeOrderVariant } from "../../../../../lib/prototype/order-history-fixtures";

export default async function OrderHistoryPrototypeLegacyVariantPage({
  params,
}: {
  params: Promise<{ variant: string }>;
}) {
  const { variant } = await params;
  if (!isPrototypeOrderVariant(variant)) {
    redirect("/order-history-prototype");
  }
  redirect(`/order-history-prototype/${variant}`);
}
