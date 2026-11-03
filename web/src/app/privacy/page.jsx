import { LegalDocumentPage } from "../../features/legal/LegalDocumentPage";
import { privacyPolicy } from "../../features/legal/privacyPolicy";

// Public, no sign-in: the Google Play and App Store listings link here.
export default function PrivacyPolicyPage() {
  return <LegalDocumentPage document={privacyPolicy} />;
}
