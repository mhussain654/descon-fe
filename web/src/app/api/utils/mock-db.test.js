import { describe, expect, it } from "vitest";
import {
  listCandidates,
  getCandidateById,
  createCandidate,
  updateCandidate,
  getDashboardStats,
  createDocument,
  verifyDocument,
  upsertTimelineStage,
} from "./mock-db";

describe("mock-db", () => {
  it("lists seeded candidates", () => {
    const candidates = listCandidates();
    expect(candidates.length).toBeGreaterThan(0);
  });

  it("filters candidates by search term across name, reg number, and cnic", () => {
    const [first] = listCandidates();
    const bySearch = listCandidates({ search: first.full_name.slice(0, 4) });
    expect(bySearch.some((c) => c.id === first.id)).toBe(true);

    const noMatch = listCandidates({ search: "no-such-candidate-xyz" });
    expect(noMatch).toHaveLength(0);
  });

  it("filters candidates by stage", () => {
    const candidates = listCandidates();
    const stage = candidates[0].current_stage;
    const filtered = listCandidates({ stage });
    expect(filtered.every((c) => c.current_stage === stage)).toBe(true);
  });

  it("creates a candidate with a registered stage and a timeline entry", () => {
    const candidate = createCandidate({
      cnic: "11111-1111111-1",
      registration_number: "DES-TEST-001",
      full_name: "Test Candidate",
    });
    expect(candidate.id).toBeDefined();
    expect(candidate.current_stage).toBe("registered");
    expect(getCandidateById(candidate.id)).toMatchObject({ full_name: "Test Candidate" });
  });

  it("updates a candidate", () => {
    const candidate = createCandidate({
      cnic: "22222-2222222-2",
      registration_number: "DES-TEST-002",
      full_name: "Another Candidate",
    });
    const updated = updateCandidate(candidate.id, { progress_percentage: 50 });
    expect(updated.progress_percentage).toBe(50);
  });

  it("returns null when updating a missing candidate", () => {
    expect(updateCandidate("does-not-exist", { progress_percentage: 50 })).toBeNull();
  });

  it("computes dashboard stats from current data", () => {
    const stats = getDashboardStats();
    expect(stats.totalCandidates).toBe(listCandidates().length);
    expect(stats.documentStats).toHaveProperty("verified");
    expect(stats.paymentStats).toHaveProperty("paid");
  });

  it("creates and verifies a document", () => {
    const candidate = createCandidate({
      cnic: "33333-3333333-3",
      registration_number: "DES-TEST-003",
      full_name: "Doc Candidate",
    });
    const document = createDocument({
      candidate_id: candidate.id,
      document_type: "passport",
    });
    expect(document.verification_status).toBe("uploaded");

    const verified = verifyDocument(document.id, { status: "verified", verified_by: "Tester" });
    expect(verified.verification_status).toBe("verified");
    expect(verified.verified_by).toBe("Tester");
  });

  it("upserts a timeline stage and updates the candidate's current stage", () => {
    const candidate = createCandidate({
      cnic: "44444-4444444-4",
      registration_number: "DES-TEST-004",
      full_name: "Timeline Candidate",
    });
    const entry = upsertTimelineStage({
      candidate_id: candidate.id,
      stage_name: "documents_uploaded",
      stage_status: "current",
    });
    expect(entry.stage_name).toBe("documents_uploaded");
    expect(getCandidateById(candidate.id).current_stage).toBe("documents_uploaded");
  });
});
