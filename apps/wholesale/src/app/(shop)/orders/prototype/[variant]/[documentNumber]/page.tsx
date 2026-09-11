import { redirect } from "next/navigation";
import { isPrototypeOrderVariant } from "../../../../../../lib/prototype/order-history-fixtures";

export default async function OrderHistoryPrototypeLegacyDetailPage({
  params,
}: {
  params: Promise<{ variant: string; documentNumber: string }>;
}) {
  const { variant, documentNumber } = await params;
  if (!isPrototypeOrderVariant(variant)) {
    redirect("/order-history-prototype");
  }
  redirect(`/order-history-prototype/${variant}/${documentNumber}`);
}
