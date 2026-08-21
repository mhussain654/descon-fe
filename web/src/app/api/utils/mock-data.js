const candidates = [
  {
    id: "cand-001",
    cnic: "35202-1234567-1",
    registration_number: "REG-2026-001",
    full_name: "Ali Raza",
    email: "ali.raza@example.com",
    phone: "+92 300 1111111",
    address: "Lahore, Pakistan",
    current_stage: "verified",
    progress_percentage: 60,
    created_at: "2026-08-10T09:00:00.000Z",
  },
  {
    id: "cand-002",
    cnic: "35202-7654321-9",
    registration_number: "REG-2026-002",
    full_name: "Ahmed Khan",
    email: "ahmed.khan@example.com",
    phone: "+92 300 2222222",
    address: "Karachi, Pakistan",
    current_stage: "documents_uploaded",
    progress_percentage: 35,
    created_at: "2026-08-12T11:30:00.000Z",
  },
  {
    id: "cand-003",
    cnic: "35201-9988776-5",
    registration_number: "REG-2026-003",
    full_name: "Usman Tariq",
    email: "usman.tariq@example.com",
    phone: "+92 300 3333333",
    address: "Islamabad, Pakistan",
    current_stage: "fee_paid",
    progress_percentage: 80,
    created_at: "2026-08-15T14:15:00.000Z",
  },
];

const documentsByCandidate = {
  "cand-001": [
    {
      id: "doc-001",
      candidate_id: "cand-001",
      document_type: "passport",
      verification_status: "verified",
      rejection_reason: null,
      verified_by: "Admin User",
      upload_date: "2026-08-10T10:00:00.000Z",
    },
    {
      id: "doc-002",
      candidate_id: "cand-001",
      document_type: "cnic_front",
      verification_status: "uploaded",
      rejection_reason: null,
      verified_by: null,
      upload_date: "2026-08-10T10:30:00.000Z",
    },
  ],
  "cand-002": [
    {
      id: "doc-003",
      candidate_id: "cand-002",
      document_type: "passport",
      verification_status: "uploaded",
      rejection_reason: null,
      verified_by: null,
      upload_date: "2026-08-12T12:00:00.000Z",
    },
  ],
  "cand-003": [
    {
      id: "doc-004",
      candidate_id: "cand-003",
      document_type: "medical_certificate",
      verification_status: "verified",
      rejection_reason: null,
      verified_by: "Admin User",
      upload_date: "2026-08-16T09:45:00.000Z",
    },
  ],
};

const timelineByCandidate = {
  "cand-001": [
    { id: "tl-001", candidate_id: "cand-001", stage_name: "registered", stage_status: "completed", created_at: "2026-08-10T09:00:00.000Z" },
    { id: "tl-002", candidate_id: "cand-001", stage_name: "documents_uploaded", stage_status: "completed", created_at: "2026-08-10T10:30:00.000Z" },
    { id: "tl-003", candidate_id: "cand-001", stage_name: "verified", stage_status: "completed", created_at: "2026-08-11T08:00:00.000Z" },
  ],
  "cand-002": [
    { id: "tl-004", candidate_id: "cand-002", stage_name: "registered", stage_status: "completed", created_at: "2026-08-12T11:30:00.000Z" },
    { id: "tl-005", candidate_id: "cand-002", stage_name: "documents_uploaded", stage_status: "in_progress", created_at: "2026-08-12T12:00:00.000Z" },
  ],
  "cand-003": [
    { id: "tl-006", candidate_id: "cand-003", stage_name: "registered", stage_status: "completed", created_at: "2026-08-15T14:15:00.000Z" },
    { id: "tl-007", candidate_id: "cand-003", stage_name: "documents_uploaded", stage_status: "completed", created_at: "2026-08-15T16:00:00.000Z" },
    { id: "tl-008", candidate_id: "cand-003", stage_name: "verified", stage_status: "completed", created_at: "2026-08-16T09:00:00.000Z" },
    { id: "tl-009", candidate_id: "cand-003", stage_name: "fee_paid", stage_status: "completed", created_at: "2026-08-17T13:30:00.000Z" },
  ],
};

const paymentsByCandidate = {
  "cand-001": [
    { id: "pay-001", candidate_id: "cand-001", amount: 25000, payment_status: "pending", created_at: "2026-08-12T09:00:00.000Z" },
  ],
  "cand-002": [],
  "cand-003": [
    { id: "pay-002", candidate_id: "cand-003", amount: 25000, payment_status: "paid", created_at: "2026-08-17T13:30:00.000Z" },
  ],
};

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export function getMockCandidates({ search = "", stage = "" } = {}) {
  return candidates
    .filter((candidate) => {
      if (stage && candidate.current_stage !== stage) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        candidate.full_name.toLowerCase().includes(q) ||
        candidate.registration_number.toLowerCase().includes(q) ||
        candidate.cnic.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function getMockStats() {
  const allDocuments = Object.values(documentsByCandidate).flat();
  const allPayments = Object.values(paymentsByCandidate).flat();

  return {
    totalCandidates: candidates.length,
    stageStats: Object.entries(
      candidates.reduce((acc, candidate) => {
        acc[candidate.current_stage] = (acc[candidate.current_stage] || 0) + 1;
        return acc;
      }, {})
    ).map(([current_stage, count]) => ({ current_stage, count })),
    documentStats: {
      verified: allDocuments.filter((doc) => doc.verification_status === "verified").length,
      pending: allDocuments.filter((doc) => doc.verification_status === "uploaded").length,
      rejected: allDocuments.filter((doc) => doc.verification_status === "rejected").length,
    },
    paymentStats: {
      paid: allPayments.filter((payment) => payment.payment_status === "paid").length,
      pending: allPayments.filter((payment) => payment.payment_status === "pending").length,
      total_collected: allPayments
        .filter((payment) => payment.payment_status === "paid")
        .reduce((sum, payment) => sum + (payment.amount || 0), 0),
    },
  };
}

export function getMockCandidateById(id) {
  const candidate = candidates.find((entry) => entry.id === id);
  if (!candidate) return null;

  return {
    candidate,
    documents: [...(documentsByCandidate[id] || [])],
    timeline: [...(timelineByCandidate[id] || [])],
    payments: [...(paymentsByCandidate[id] || [])],
  };
}

export function updateMockDocumentVerification(id, status, rejectionReason = null, verifiedBy = null) {
  for (const docs of Object.values(documentsByCandidate)) {
    const document = docs.find((entry) => entry.id === id);
    if (!document) continue;

    document.verification_status = status;
    document.rejection_reason = rejectionReason;
    document.verified_by = verifiedBy;
    document.verified_at = new Date().toISOString();
    return document;
  }

  return null;
}
