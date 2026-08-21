import { useState } from "react";
import UserShell from "../components/user-shell";

export default function ProfilePage() {
  const [language, setLanguage] = useState("en");

  const profileData = {
    name: "Ahmed Khan",
    cnic: "12345-1234567-1",
    regNumber: "DES-2026-001",
    phone: "+92 300 1234567",
    email: "ahmed.khan@example.com",
    address: "Lahore, Pakistan",
  };

  const infoRows = [
    { label: "CNIC", value: profileData.cnic },
    { label: "Phone", value: profileData.phone },
    { label: "Email", value: profileData.email },
    { label: "Address", value: profileData.address },
  ];

  return (
    <UserShell activeTab="/profile">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <h1 className="text-3xl font-semibold text-black">Profile</h1>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8">
        <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[#0066CC] text-3xl font-semibold text-white">
            {profileData.name.charAt(0)}
          </div>
          <div className="text-xl font-semibold text-black">{profileData.name}</div>
          <div className="mt-1 text-sm text-gray-500">{profileData.regNumber}</div>
        </section>

        <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-black">Personal Information</h2>
          <div>
            {infoRows.map((row) => (
              <div
                key={row.label}
                className="flex items-start justify-between border-b border-gray-100 py-4 last:border-b-0"
              >
                <div className="text-sm text-gray-500">{row.label}</div>
                <div className="max-w-[70%] text-right text-sm font-medium text-black">
                  {row.value}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-2">
          <button
            type="button"
            onClick={() => setLanguage((current) => (current === "en" ? "ur" : "en"))}
            className="flex w-full items-center justify-between rounded-xl px-4 py-4 text-left transition hover:bg-[#F6F6F6]"
          >
            <div>
              <div className="text-sm font-medium text-black">Language</div>
              <div className="mt-1 text-sm text-gray-500">
                {language === "en" ? "English" : "اردو"}
              </div>
            </div>
            <div className="text-gray-400">›</div>
          </button>
        </section>

        <a
          href="/login"
          className="flex items-center justify-center rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] px-6 py-4 text-base font-semibold text-[#EF4444]"
        >
          Logout
        </a>
      </div>
    </UserShell>
  );
}
