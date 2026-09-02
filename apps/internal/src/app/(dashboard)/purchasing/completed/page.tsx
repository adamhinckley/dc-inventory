import { permanentRedirect } from "next/navigation";

export default function CompletedPurchaseOrdersRedirectPage() {
  permanentRedirect("/purchasing");
}
