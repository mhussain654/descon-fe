// In-memory mock data store for the admin/candidates prototype.
//
// This replaces a previous direct Neon Postgres connection. The frontend must
// not connect to a database directly — real data will come from the Rails
// API once that integration ticket lands. Until then, these in-memory arrays
// back the same request/response shapes the admin UI already expects, so the
// preserved prototype routes keep working. State resets whenever the dev
// server restarts.

let nextCandidateId = 4;
let nextDocumentId = 5;
let nextTimelineId = 6;

const candidates = [
  {
    id: 1,
    cnic: '35202-1234567-1',
    registration_number: 'DES-2026-001',
    full_name: 'Ahmed Khan',
    email: 'ahmed.khan@example.com',
    phone: '+92 300 1234567',
    address: 'Lahore, Pakistan',
    current_stage: 'documents_uploaded',
    progress_percentage: 30,
    created_at: '2026-08-10T09:00:00.000Z',
    updated_at: '2026-08-16T11:00:00.000Z',
  },
  {
    id: 2,
    cnic: '42101-7654321-3',
    registration_number: 'DES-2026-002',
    full_name: 'Sara Bibi',
    email: 'sara.bibi@example.com',
    phone: '+92 321 9876543',
    address: 'Karachi, Pakistan',
    current_stage: 'verified',
    progress_percentage: 55,
    created_at: '2026-08-05T09:00:00.000Z',
    updated_at: '2026-08-18T14:30:00.000Z',
  },
  {
    id: 3,
    cnic: '61101-1122334-5',
    registration_number: 'DES-2026-003',
    full_name: 'Bilal Hussain',
    email: 'bilal.hussain@example.com',
    phone: '+92 333 4567890',
    address: 'Islamabad, Pakistan',
    current_stage: 'fee_paid',
    progress_percentage: 75,
    created_at: '2026-07-28T09:00:00.000Z',
    updated_at: '2026-08-19T10:15:00.000Z',
  },
];

const documents = [
  {
    id: 1,
    candidate_id: 1,
    document_type: 'passport',
    file_url: null,
    verification_status: 'verified',
    upload_date: '2026-08-15T09:00:00.000Z',
    rejection_reason: null,
    verified_by: 'Admin User',
    verified_at: '2026-08-16T09:00:00.000Z',
  },
  {
    id: 2,
    candidate_id: 1,
    document_type: 'cnic_front',
    file_url: null,
    verification_status: 'uploaded',
    upload_date: '2026-08-16T09:00:00.000Z',
    rejection_reason: null,
    verified_by: null,
    verified_at: null,
  },
  {
    id: 3,
    candidate_id: 2,
    document_type: 'passport',
    file_url: null,
    verification_status: 'verified',
    upload_date: '2026-08-10T09:00:00.000Z',
    rejection_reason: null,
    verified_by: 'Admin User',
    verified_at: '2026-08-11T09:00:00.000Z',
  },
  {
    id: 4,
    candidate_id: 3,
    document_type: 'police_character',
    file_url: null,
    verification_status: 'rejected',
    upload_date: '2026-08-01T09:00:00.000Z',
    rejection_reason: 'Document expired',
    verified_by: 'Admin User',
    verified_at: '2026-08-02T09:00:00.000Z',
  },
];

const statusTimeline = [
  { id: 1, candidate_id: 1, stage_name: 'registered', stage_status: 'completed', completed_date: '2026-08-10T09:00:00.000Z', notes: null, updated_by: null, created_at: '2026-08-10T09:00:00.000Z' },
  { id: 2, candidate_id: 1, stage_name: 'documents_uploaded', stage_status: 'current', completed_date: null, notes: null, updated_by: null, created_at: '2026-08-16T09:00:00.000Z' },
  { id: 3, candidate_id: 2, stage_name: 'registered', stage_status: 'completed', completed_date: '2026-08-05T09:00:00.000Z', notes: null, updated_by: null, created_at: '2026-08-05T09:00:00.000Z' },
  { id: 4, candidate_id: 2, stage_name: 'verified', stage_status: 'completed', completed_date: '2026-08-18T09:00:00.000Z', notes: null, updated_by: 'Admin User', created_at: '2026-08-18T09:00:00.000Z' },
  { id: 5, candidate_id: 3, stage_name: 'fee_paid', stage_status: 'completed', completed_date: '2026-08-19T09:00:00.000Z', notes: null, updated_by: 'Admin User', created_at: '2026-08-19T09:00:00.000Z' },
];

const payments = [
  { id: 1, candidate_id: 3, amount: 25000, payment_status: 'paid', reference: 'PAY-2026-001', created_at: '2026-08-19T09:00:00.000Z' },
  { id: 2, candidate_id: 2, amount: 25000, payment_status: 'pending', reference: 'PAY-2026-002', created_at: '2026-08-18T09:00:00.000Z' },
];

export function listCandidates({ search, stage } = {}) {
  let results = candidates;
  if (search) {
    const needle = search.toLowerCase();
    results = results.filter(
      (c) =>
        c.full_name.toLowerCase().includes(needle) ||
        c.registration_number.toLowerCase().includes(needle) ||
        c.cnic.toLowerCase().includes(needle)
    );
  }
  if (stage) {
    results = results.filter((c) => c.current_stage === stage);
  }
  return [...results].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function getCandidateById(id) {
  return candidates.find((c) => String(c.id) === String(id)) ?? null;
}

export function createCandidate({ cnic, registration_number, full_name, email, phone, address }) {
  const now = new Date().toISOString();
  const candidate = {
    id: nextCandidateId++,
    cnic,
    registration_number,
    full_name,
    email: email ?? null,
    phone: phone ?? null,
    address: address ?? null,
    current_stage: 'registered',
    progress_percentage: 0,
    created_at: now,
    updated_at: now,
  };
  candidates.push(candidate);
  statusTimeline.push({
    id: nextTimelineId++,
    candidate_id: candidate.id,
    stage_name: 'registered',
    stage_status: 'completed',
    completed_date: now,
    notes: null,
    updated_by: null,
    created_at: now,
  });
  return candidate;
}

export function updateCandidate(id, fields) {
  const candidate = getCandidateById(id);
  if (!candidate) return null;
  Object.assign(candidate, fields, { updated_at: new Date().toISOString() });
  return candidate;
}

export function getDocumentsForCandidate(id) {
  return documents
    .filter((d) => String(d.candidate_id) === String(id))
    .sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date));
}

export function getTimelineForCandidate(id) {
  return statusTimeline
    .filter((t) => String(t.candidate_id) === String(id))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

export function getPaymentsForCandidate(id) {
  return payments
    .filter((p) => String(p.candidate_id) === String(id))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function getDashboardStats() {
  const documentStats = documents.reduce(
    (acc, d) => {
      if (d.verification_status === 'verified') acc.verified++;
      if (d.verification_status === 'uploaded') acc.pending++;
      if (d.verification_status === 'rejected') acc.rejected++;
      return acc;
    },
    { verified: 0, pending: 0, rejected: 0 }
  );

  const paymentStats = payments.reduce(
    (acc, p) => {
      if (p.payment_status === 'paid') {
        acc.paid++;
        acc.total_collected += p.amount;
      }
      if (p.payment_status === 'pending') acc.pending++;
      return acc;
    },
    { paid: 0, pending: 0, total_collected: 0 }
  );

  const stageStats = Object.entries(
    candidates.reduce((acc, c) => {
      acc[c.current_stage] = (acc[c.current_stage] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([current_stage, count]) => ({ current_stage, count }));

  return {
    totalCandidates: candidates.length,
    stageStats,
    documentStats,
    paymentStats,
  };
}

export function createDocument({ candidate_id, document_type, file_url }) {
  const document = {
    id: nextDocumentId++,
    candidate_id,
    document_type,
    file_url: file_url ?? null,
    verification_status: 'uploaded',
    upload_date: new Date().toISOString(),
    rejection_reason: null,
    verified_by: null,
    verified_at: null,
  };
  documents.push(document);
  return document;
}

export function verifyDocument(id, { status, rejection_reason, verified_by }) {
  const document = documents.find((d) => String(d.id) === String(id));
  if (!document) return null;
  document.verification_status = status;
  document.rejection_reason = rejection_reason ?? null;
  document.verified_by = verified_by ?? null;
  document.verified_at = new Date().toISOString();
  return document;
}

export function upsertTimelineStage({ candidate_id, stage_name, stage_status, notes, updated_by }) {
  const now = new Date().toISOString();
  let entry = statusTimeline.find(
    (t) => String(t.candidate_id) === String(candidate_id) && t.stage_name === stage_name
  );
  if (entry) {
    entry.stage_status = stage_status;
    entry.completed_date = stage_status === 'completed' ? now : null;
    entry.notes = notes ?? null;
    entry.updated_by = updated_by ?? null;
  } else {
    entry = {
      id: nextTimelineId++,
      candidate_id,
      stage_name,
      stage_status,
      completed_date: stage_status === 'completed' ? now : null,
      notes: notes ?? null,
      updated_by: updated_by ?? null,
      created_at: now,
    };
    statusTimeline.push(entry);
  }
  const candidate = getCandidateById(candidate_id);
  if (candidate) {
    candidate.current_stage = stage_name;
    candidate.updated_at = now;
  }
  return entry;
}
