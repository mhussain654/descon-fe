import UserShell from "../components/user-shell";
import { useLanguage } from "../../contexts/LanguageContext";

const documents = [
  { id: 1, nameKey: "passport", status: "verified", uploadDate: "2026-08-15" },
  { id: 2, nameKey: "cnicFront", status: "verified", uploadDate: "2026-08-15" },
  { id: 3, nameKey: "cnicBack", status: "verified", uploadDate: "2026-08-15" },
  { id: 4, nameKey: "nextOfKinCNIC", status: "uploaded", uploadDate: "2026-08-16" },
  { id: 5, nameKey: "policeCharacter", status: "uploaded", uploadDate: "2026-08-16" },
  { id: 6, nameKey: "bankDetails", status: "pending", uploadDate: null },
  { id: 7, nameKey: "chequeImage", status: "pending", uploadDate: null },
  { id: 8, nameKey: "cv", status: "rejected", uploadDate: "2026-08-14", reasonKey: "poorQualityImage" },
];

const statusConfig = {
  verified: { labelKey: "verified", badge: "bg-[#E6F9F0] text-[#10B981]" },
  uploaded: { labelKey: "uploaded", badge: "bg-[#FFF7E6] text-[#F59E0B]" },
  rejected: { labelKey: "rejected", badge: "bg-[#FEF2F2] text-[#EF4444]" },
  pending: { labelKey: "pending", badge: "bg-[#F6F6F6] text-[#6B7280]" },
};

export default function DocumentsPage() {
  const { t } = useLanguage();

  return (
    <UserShell activeTab="/documents">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <h1 className="text-3xl font-semibold text-black">{t("documents")}</h1>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="grid gap-4 md:grid-cols-4">
          {["verified", "uploaded", "pending", "rejected"].map((key) => (
            <div key={key} className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-3xl font-semibold text-black">
                {documents.filter((doc) => doc.status === key).length}
              </div>
              <div className="mt-1 text-sm text-gray-500">{t(statusConfig[key].labelKey)}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white">
          {documents.map((doc) => (
            <div key={doc.id} className="border-b border-gray-100 px-6 py-5 last:border-b-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-base font-medium text-black">{t(doc.nameKey)}</div>
                  <div className="mt-1 text-sm text-gray-500">
                    {doc.uploadDate ? `${t("uploadedOnPrefix")} ${doc.uploadDate}` : t("notUploadedYet")}
                  </div>
                  {doc.reasonKey ? (
                    <div className="mt-2 text-sm text-[#EF4444]">
                      {t("reasonPrefix")}: {t(doc.reasonKey)}
                    </div>
                  ) : null}
                </div>
                <div className={`rounded-xl px-3 py-2 text-sm font-semibold ${statusConfig[doc.status].badge}`}>
                  {t(statusConfig[doc.status].labelKey)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </UserShell>
  );
}
