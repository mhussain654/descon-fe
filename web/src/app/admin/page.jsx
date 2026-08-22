"use client";

import { useEffect, useState } from "react";
import { Users, FileCheck, DollarSign, Search } from "lucide-react";

export default function AdminDashboard() {
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

  const workflowStages = [
    { id: "registered", label: "Registered", color: "#3B82F6" },
    { id: "documents_uploaded", label: "Docs Uploaded", color: "#F59E0B" },
    { id: "verified", label: "Verified", color: "#10B981" },
    { id: "fee_paid", label: "Fee Paid", color: "#8B5CF6" },
    { id: "mobilized", label: "Mobilized", color: "#059669" },
  ];

  const getStageCount = (stageId) => {
    return candidates.filter((c) => c.current_stage === stageId).length;
  };

  const formatStage = (stage) => {
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
                <div className="text-gray-600">Total Candidates</div>
                <div className="text-2xl font-semibold text-gray-900">
                  {stats?.totalCandidates || 0}
                </div>
              </div>
              <div className="h-10 w-px bg-gray-300 hidden sm:block" />
              <a
                href="/admin/candidates/new"
                className="bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-800 whitespace-nowrap"
              >
                + Add Candidate
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
              Workflow Pipeline
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
                All ({candidates.length})
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
                    {stage.label} ({count})
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
                  placeholder="Search by name, CNIC, or registration number..."
                  className="w-full pl-10 pr-4 py-2.5 text-sm border-0 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-900"
                />
              </div>
              <button
                type="submit"
                className="bg-gray-900 text-white px-4 sm:px-6 text-sm font-medium hover:bg-gray-800 whitespace-nowrap"
              >
                Search
              </button>
            </form>
          </div>

          <div className="grid grid-cols-2 gap-4 md:flex md:shrink-0">
            <div className="bg-white border border-gray-300 px-4 py-2.5 sm:px-6 md:min-w-[140px]">
              <div className="text-xs text-gray-600 uppercase tracking-wide">
                Verified
              </div>
              <div className="text-xl font-semibold text-gray-900">
                {stats?.documentStats.verified || 0}
              </div>
            </div>
            <div className="bg-white border border-gray-300 px-4 py-2.5 sm:px-6 md:min-w-[140px]">
              <div className="text-xs text-gray-600 uppercase tracking-wide">
                Payments
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
                    Candidate
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide">
                    Reg. Number
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide">
                    CNIC
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide">
                    Stage
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide">
                    Progress
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide">
                    Action
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
                      Loading...
                    </td>
                  </tr>
                ) : candidates.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-4 py-8 text-center text-sm text-gray-500"
                    >
                      No candidates found
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
                          View
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
