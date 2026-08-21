const timeline = [
  { id: 1, label: "Registered", status: "completed", date: "2026-08-10" },
  { id: 2, label: "Documents Pending", status: "completed", date: "2026-08-12" },
  { id: 3, label: "Documents Uploaded", status: "current", date: "2026-08-16" },
  { id: 4, label: "Verified", status: "pending", date: null },
  { id: 5, label: "Fee Pending", status: "pending", date: null },
  { id: 6, label: "Fee Paid", status: "pending", date: null },
  { id: 7, label: "Shared with Business Unit", status: "pending", date: null },
  { id: 8, label: "QVC Appointment Booked", status: "pending", date: null },
  { id: 9, label: "QVC Outcome", status: "pending", date: null },
  { id: 10, label: "Visa Issued", status: "pending", date: null },
  { id: 11, label: "Protection Completed", status: "pending", date: null },
  { id: 12, label: "Ready to Fly", status: "pending", date: null },
  { id: 13, label: "Flight Details Uploaded", status: "pending", date: null },
  { id: 14, label: "Mobilized", status: "pending", date: null },
];

export default function StatusPage() {
  return (
    <UserShell activeTab="/status">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <h1 className="text-3xl font-semibold text-black">Status</h1>
          <p className="mt-1 text-sm text-gray-500">Mobilization Progress</p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          {timeline.map((item, index) => (
            <div key={item.id} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    item.status === "completed"
                      ? "bg-[#E6F9F0] text-[#10B981]"
                      : item.status === "current"
                        ? "bg-[#E6F2FF] text-[#0066CC]"
                        : "bg-white text-[#9CA3AF] ring-2 ring-gray-200"
                  }`}
                >
                  {item.status === "completed" ? "✓" : item.status === "current" ? "•" : ""}
                </div>
                {index < timeline.length - 1 ? (
                  <div
                    className={`min-h-12 w-0.5 ${
                      item.status === "completed" ? "bg-[#10B981]" : "bg-gray-200"
                    }`}
                  />
                ) : null}
              </div>
              <div className="pb-6">
                <div
                  className={`text-base ${
                    item.status === "current" ? "font-semibold text-black" : "font-medium text-black"
                  }`}
                >
                  {item.label}
                </div>
                {item.date ? <div className="mt-1 text-sm text-gray-500">{item.date}</div> : null}
                {item.status === "current" ? (
                  <div className="mt-3 inline-flex rounded-lg bg-[#E6F2FF] px-3 py-2 text-xs font-medium text-[#0066CC]">
                    In Progress
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </UserShell>
  );
}
import UserShell from "../components/user-shell";
