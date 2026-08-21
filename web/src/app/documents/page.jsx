const documents = [
  { id: 1, name: "Passport", status: "verified", uploadDate: "2026-08-15" },
  { id: 2, name: "CNIC (Front)", status: "verified", uploadDate: "2026-08-15" },
  { id: 3, name: "CNIC (Back)", status: "verified", uploadDate: "2026-08-15" },
  { id: 4, name: "Next of Kin CNIC", status: "uploaded", uploadDate: "2026-08-16" },
  { id: 5, name: "Police Character Certificate", status: "uploaded", uploadDate: "2026-08-16" },
  { id: 6, name: "Bank Details", status: "pending", uploadDate: null },
  { id: 7, name: "Cheque/ATM Image", status: "pending", uploadDate: null },
  { id: 8, name: "CV/Resume", status: "rejected", uploadDate: "2026-08-14", reason: "Poor quality image" },
];

const statusConfig = {
  verified: { label: "Verified", badge: "bg-[#E6F9F0] text-[#10B981]" },
  uploaded: { label: "Uploaded", badge: "bg-[#FFF7E6] text-[#F59E0B]" },
  rejected: { label: "Rejected", badge: "bg-[#FEF2F2] text-[#EF4444]" },
  pending: { label: "Pending", badge: "bg-[#F6F6F6] text-[#6B7280]" },
};

export default function DocumentsPage() {
  return (
    <UserShell activeTab="/documents">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <h1 className="text-3xl font-semibold text-black">Documents</h1>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="grid gap-4 md:grid-cols-4">
          {["verified", "uploaded", "pending", "rejected"].map((key) => (
            <div key={key} className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-3xl font-semibold text-black">
                {documents.filter((doc) => doc.status === key).length}
              </div>
              <div className="mt-1 text-sm text-gray-500">{statusConfig[key].label}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white">
          {documents.map((doc) => (
            <div key={doc.id} className="border-b border-gray-100 px-6 py-5 last:border-b-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-base font-medium text-black">{doc.name}</div>
                  <div className="mt-1 text-sm text-gray-500">
                    {doc.uploadDate ? `Uploaded on ${doc.uploadDate}` : "Not uploaded yet"}
                  </div>
                  {doc.reason ? (
                    <div className="mt-2 text-sm text-[#EF4444]">Reason: {doc.reason}</div>
                  ) : null}
                </div>
                <div className={`rounded-xl px-3 py-2 text-sm font-semibold ${statusConfig[doc.status].badge}`}>
                  {statusConfig[doc.status].label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </UserShell>
  );
}
import UserShell from "../components/user-shell";
