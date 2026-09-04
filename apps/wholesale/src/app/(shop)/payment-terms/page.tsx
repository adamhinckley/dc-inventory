import { LegalDocPage } from "../../../components/legal-doc-page";
import { paymentTermsCopy } from "../../../lib/legal-copy";

export default function PaymentTermsPage() {
  return <LegalDocPage copy={paymentTermsCopy} />;
}
