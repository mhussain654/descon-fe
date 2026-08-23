"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";
import { StaffShell } from "../components/staff-shell";

const workflowStages = [
  { id: "registered", labelKey: "registered", color: "#3B82F6" },
  { id: "documents_uploaded", labelKey: "documentsUploaded", color: "#F59E0B" },
  { id: "verified", labelKey: "verified", color: "#10B981" },
  { id: "fee_paid", labelKey: "feePaid", color: "#8B5CF6" },
  { id: "mobilized", labelKey: "mobilized", color: "#059669" },
];

// This candidate-management console had no auth guard at all before
// MPS-F202/MPS-F203 introduced staff authentication -- StaffShell (which
// wraps every staff screen in RequireStaffAuth) closes that gap here too,
// since a staff-auth system that protects nothing else in the portal isn't
// meaningful. No internal restructuring beyond the guard itself.
export default function AdminDashboardPage() {
  return (
    <StaffShell>
      <AdminDashboard />
    </StaffShell>
  );
}

function AdminDashboard() {
  const { t } = useLanguage();
  const [stats, setStats] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStage, setSelectedStage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchCandidates();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/stats");
      if (!response.ok) throw new Error("Failed to fetch stats");
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchCandidates = async (search = "", stage = "") => {
    try {
      setLoading(true);
      let url = "/api/candidates?";
      if (search) url += `search=${encodeURIComponent(search)}&`;
      if (stage) url += `stage=${encodeURIComponent(stage)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch candidates");
      const data = await response.json();
      setCandidates(data.candidates);
    } catch (error) {
      console.error("Error fetching candidates:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchCandidates(searchTerm, selectedStage);
  };

  const handleStageFilter = (stage) => {
    setSelectedStage(stage);
    fetchCandidates(searchTerm, stage);
  };

  const getStageCount = (stageId) => {
    return candidates.filter((c) => c.current_stage === stageId).length;
  };

  const stageLabelKeys = {
    registered: "registered",
    documents_uploaded: "documentsUploaded",
    verified: "verified",
    fee_paid: "feePaid",
    mobilized: "mobilized",
  };

  const formatStage = (stage) => {
    const labelKey = stageLabelKeys[stage];
    if (labelKey) return t(labelKey);
    // Fall back to a readable label for any stage value not in the known
    // set, rather than silently rendering nothing.
    return stage
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <div className="bg-white border-b border-gray-300">
        <div className="max-w-[1600px] mx-auto px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <img
                src="https://ucarecdn.com/26b1d36a-12cf-4efa-853d-08da75f95d7e/-/format/auto/"
                alt="Descon"
                className="h-8 sm:h-10"
              />
              <div className="border-l border-gray-300 h-8 sm:h-10" />
              <div>
                <h1 className="text-lg font-semibold text-gray-900 sm:text-2xl">
                  Descon Manpower
                </h1>
                <p className="text-xs text-gray-600 mt-0.5 sm:text-sm">
                  Descon Engineering
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 sm:justify-end">
              <div className="text-sm sm:text-right">
                <div className="text-gray-600">{t("adminTotalCandidates")}</div>
                <div className="text-2xl font-semibold text-gray-900">
                  {stats?.totalCandidates || 0}
                </div>
              </div>
              <div className="h-10 w-px bg-gray-300 hidden sm:block" />
              <a
                href="/admin/candidates/new"
                className="bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-800 whitespace-nowrap"
              >
                {t("adminAddCandidate")}
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 py-6 sm:px-6">
        {/* Workflow Pipeline */}
        <div className="bg-white border border-gray-300 mb-6">
          <div className="px-4 py-3 border-b border-gray-300 bg-gray-50">
            <h2 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
              {t("adminWorkflowPipeline")}
            </h2>
          </div>
          <div className="p-4">
            <div className="flex gap-2 overflow-x-auto">
              <button
                onClick={() => handleStageFilter("")}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap border ${
                  selectedStage === ""
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {t("adminAll")} ({candidates.length})
              </button>
              {workflowStages.map((stage) => {
                const count = getStageCount(stage.id);
                return (
                  <button
                    key={stage.id}
                    onClick={() => handleStageFilter(stage.id)}
                    className={`px-4 py-2 text-sm font-medium whitespace-nowrap border ${
                      selectedStage === stage.id
                        ? "text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                    style={
                      selectedStage === stage.id
                        ? {
                            backgroundColor: stage.color,
                            borderColor: stage.color,
                          }
                        : {}
                    }
                  >
                    {t(stage.labelKey)} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Search and Stats */}
        <div className="flex flex-col gap-4 mb-6 md:flex-row md:gap-6">
          <div className="flex-1 bg-white border border-gray-300">
            <form onSubmit={handleSearch} className="flex">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t("adminSearchPlaceholder")}
                  className="w-full pl-10 pr-4 py-2.5 text-sm border-0 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-900"
                />
              </div>
              <button
                type="submit"
                className="bg-gray-900 text-white px-4 sm:px-6 text-sm font-medium hover:bg-gray-800 whitespace-nowrap"
              >
                {t("adminSearch")}
              </button>
            </form>
          </div>

          <div className="grid grid-cols-2 gap-4 md:flex md:shrink-0">
            <div className="bg-white border border-gray-300 px-4 py-2.5 sm:px-6 md:min-w-[140px]">
              <div className="text-xs text-gray-600 uppercase tracking-wide">
                {t("verified")}
              </div>
              <div className="text-xl font-semibold text-gray-900">
                {stats?.documentStats.verified || 0}
              </div>
            </div>
            <div className="bg-white border border-gray-300 px-4 py-2.5 sm:px-6 md:min-w-[140px]">
              <div className="text-xs text-gray-600 uppercase tracking-wide">
                {t("adminPayments")}
              </div>
              <div className="text-xl font-semibold text-gray-900">
                {stats?.paymentStats.paid || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white border border-gray-300">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-300 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide">
                    {t("adminTableCandidate")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide">
                    {t("adminTableRegNumber")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide">
                    {t("cnicShort")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide">
                    {t("adminTableStage")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide">
                    {t("adminTableProgress")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide">
                    {t("adminTableAction")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-4 py-8 text-center text-sm text-gray-500"
                    >
                      {t("loading")}
                    </td>
                  </tr>
                ) : candidates.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-4 py-8 text-center text-sm text-gray-500"
                    >
                      {t("adminNoCandidatesFound")}
                    </td>
                  </tr>
                ) : (
                  candidates.map((candidate) => (
                    <tr key={candidate.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-900 text-white flex items-center justify-center text-xs font-semibold">
                            {candidate.full_name.charAt(0)}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {candidate.full_name}
                            </div>
                            <div className="text-xs text-gray-600">
                              {candidate.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                        {candidate.registration_number}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                        {candidate.cnic}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-gray-900 px-2 py-1 bg-gray-100 border border-gray-300">
                          {formatStage(candidate.current_stage)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 h-1.5">
                            <div
                              className="bg-gray-900 h-1.5"
                              style={{
                                width: `${candidate.progress_percentage}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-gray-600 font-medium w-8">
                            {candidate.progress_percentage}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`/admin/candidates/${candidate.id}`}
                          className="text-sm font-medium text-gray-900 hover:underline"
                        >
                          {t("adminView")}
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
