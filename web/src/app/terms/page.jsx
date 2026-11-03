import { LegalDocumentPage } from "../../features/legal/LegalDocumentPage";
import { termsAndConditions } from "../../features/legal/termsAndConditions";

// Public, no sign-in: the Google Play and App Store listings link here.
export default function TermsAndConditionsPage() {
  return <LegalDocumentPage document={termsAndConditions} />;
}
