"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle, XCircle, Clock, Upload } from "lucide-react";
import { formatCurrency } from "../../../../../../shared/i18n/locale";
import { useLanguage } from "../../../../contexts/LanguageContext";
import { useStaffAuth } from "../../../../contexts/StaffAuthContext";
import { StaffShell } from "../../../components/staff-shell";

const documentTypeKeys = {
  passport: "passport",
  cnic_front: "cnicFront",
  cnic_back: "cnicBack",
  next_of_kin_cnic: "nextOfKinCNIC",
  police_character: "policeCharacter",
  bank_details: "bankDetails",
  cheque_image: "chequeImage",
  cv: "cv",
};

const stageNameKeys = {
  registered: "registered",
  documents_pending: "documentsPending",
  documents_uploaded: "documentsUploaded",
  verified: "documentsVerified",
  fee_pending: "feePending",
  fee_paid: "feePaid",
  shared_with_bu: "sharedWithBU",
  qvc_booked: "qvcBooked",
  qvc_outcome: "qvcOutcome",
  visa_issued: "visaIssued",
  protection_completed: "protectionCompleted",
  ready_to_fly: "readyToFly",
  flight_details_uploaded: "flightDetailsUploaded",
  mobilized: "mobilized",
};

// No auth guard existed here before MPS-F202/MPS-F203 -- see the identical
// note in ../../page.jsx. Document verification is additionally gated on
// `canVerifyDocuments` below, so a viewer-role staff member can see this
// page (read-only) but never gets the Verify/Reject controls at all.
export default function CandidateDetailsPage({ params }) {
  return (
    <StaffShell>
      <CandidateDetails params={params} />
    </StaffShell>
  );
}

function CandidateDetails({ params }) {
  const { t, language } = useLanguage();
  const { hasPermission } = useStaffAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params?.id) {
      fetchCandidateData();
    }
  }, [params?.id]);

  const fetchCandidateData = async () => {
    try {
      const response = await fetch(`/api/candidates/${params.id}`);
      if (!response.ok) throw new Error("Failed to fetch candidate");
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Error fetching candidate:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyDocument = async (documentId, status, reason = null) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          rejection_reason: reason,
          verified_by: "Admin User",
        }),
      });

      if (!response.ok) throw new Error("Failed to verify document");

      fetchCandidateData();
    } catch (error) {
      console.error("Error verifying document:", error);
      alert(t("adminFailedToVerifyDocument"));
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "verified":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "rejected":
        return <XCircle className="w-5 h-5 text-red-600" />;
      case "uploaded":
        return <Clock className="w-5 h-5 text-yellow-600" />;
      default:
        return <Upload className="w-5 h-5 text-gray-400" />;
    }
  };

  const formatDocumentType = (type) => {
    const labelKey = documentTypeKeys[type];
    if (labelKey) return t(labelKey);
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const formatStageName = (stageName) => {
    const labelKey = stageNameKeys[stageName];
    if (labelKey) return t(labelKey);
    return stageName
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">{t("loading")}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">{t("adminCandidateNotFound")}</div>
      </div>
    );
  }

  const { candidate, documents, timeline, payments } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <a
            href="/admin"
            className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("adminBackToDashboard")}
          </a>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {candidate.full_name}
              </h1>
              <p className="text-gray-600 mt-1">
                {candidate.registration_number}
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">{t("progressLabel")}</div>
              <div className="text-2xl font-bold text-blue-600">
                {candidate.progress_percentage}%
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Candidate Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Personal Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {t("personalInfo")}
              </h2>
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-gray-600">{t("cnicShort")}</div>
                  <div className="text-sm font-medium text-gray-900">
                    {candidate.cnic}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">{t("emailShort")}</div>
                  <div className="text-sm font-medium text-gray-900">
                    {candidate.email || t("notAvailable")}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">{t("phoneShort")}</div>
                  <div className="text-sm font-medium text-gray-900">
                    {candidate.phone || t("notAvailable")}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">{t("addressShort")}</div>
                  <div className="text-sm font-medium text-gray-900">
                    {candidate.address || t("notAvailable")}
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {t("paymentStatus")}
              </h2>
              {payments.length > 0 ? (
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="border-b border-gray-200 pb-3 last:border-0"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{t("amount")}</span>
                        <span className="text-sm font-medium">
                          {formatCurrency(payment.amount ?? 0, language)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-sm text-gray-600">{t("status")}</span>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            payment.payment_status === "paid"
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {payment.payment_status === "paid" ? t("feePaid") : t("pending")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">{t("adminNoPaymentRecords")}</p>
              )}
            </div>
          </div>

          {/* Right Column - Documents and Timeline */}
          <div className="lg:col-span-2 space-y-6">
            {/* Documents */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {t("documents")}
              </h2>
              <div className="space-y-3">
                {documents.length > 0 ? (
                  documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(doc.verification_status)}
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {formatDocumentType(doc.document_type)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {t("uploadedOnPrefix")}{" "}
                              {new Date(doc.upload_date).toLocaleDateString()}
                            </div>
                            {doc.rejection_reason && (
                              <div className="text-xs text-red-600 mt-1">
                                {t("reasonPrefix")}: {doc.rejection_reason}
                              </div>
                            )}
                          </div>
                        </div>
                        {doc.verification_status === "uploaded" && hasPermission("canVerifyDocuments") && (
                          <div className="flex space-x-2">
                            <button
                              onClick={() =>
                                handleVerifyDocument(doc.id, "verified")
                              }
                              className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                            >
                              {t("verifyAction")}
                            </button>
                            <button
                              onClick={() => {
                                const reason = prompt(t("adminEnterRejectionReason"));
                                if (reason)
                                  handleVerifyDocument(
                                    doc.id,
                                    "rejected",
                                    reason,
                                  );
                              }}
                              className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                            >
                              {t("rejectAction")}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">{t("adminNoDocumentsUploaded")}</p>
                )}
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {t("adminStatusTimeline")}
              </h2>
              <div className="space-y-4">
                {timeline.map((item, index) => (
                  <div key={item.id} className="flex">
                    <div className="flex flex-col items-center mr-4">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          item.stage_status === "completed"
                            ? "bg-green-100"
                            : item.stage_status === "current"
                              ? "bg-blue-100"
                              : "bg-gray-100"
                        }`}
                      >
                        {item.stage_status === "completed" ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : item.stage_status === "current" ? (
                          <Clock className="w-4 h-4 text-blue-600" />
                        ) : (
                          <div className="w-2 h-2 bg-gray-400 rounded-full" />
                        )}
                      </div>
                      {index < timeline.length - 1 && (
                        <div
                          className={`w-0.5 h-12 ${
                            item.stage_status === "completed"
                              ? "bg-green-300"
                              : "bg-gray-300"
                          }`}
                        />
                      )}
                    </div>
                    <div className="flex-1 pb-8">
                      <div className="text-sm font-medium text-gray-900">
                        {formatStageName(item.stage_name)}
                      </div>
                      {item.completed_date && (
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(item.completed_date).toLocaleDateString()}
                        </div>
                      )}
                      {item.notes && (
                        <div className="text-xs text-gray-600 mt-1">
                          {item.notes}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
