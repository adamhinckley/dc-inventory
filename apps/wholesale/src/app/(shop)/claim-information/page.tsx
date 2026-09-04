import { LegalDocPage } from "../../../components/legal-doc-page";
import { claimsCopy } from "../../../lib/legal-copy";

export default function ClaimInformationPage() {
  return <LegalDocPage copy={claimsCopy} />;
}
