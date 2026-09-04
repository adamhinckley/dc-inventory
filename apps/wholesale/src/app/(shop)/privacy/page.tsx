import { LegalDocPage } from "../../../components/legal-doc-page";
import { privacyCopy } from "../../../lib/legal-copy";

export default function PrivacyPage() {
  return <LegalDocPage copy={privacyCopy} />;
}
