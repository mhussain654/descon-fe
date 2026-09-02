"use client";

import { StaffShell } from "../components/staff-shell";
import { CandidateListWorkspace } from "../../features/admin/candidates/components/CandidateListWorkspace";

// Rebuilt for MPS-F303 -- this used to be entirely mock data (fetch calls
// to non-existent /api/stats and /api/candidates routes, fabricated
// candidate IDs feeding into the real detail route). CandidateListWorkspace
// below is the real replacement: server-side search/filter/sort/pagination
// against GET /api/v1/admin/candidates, all backed by the URL. StaffShell
// (which wraps every staff screen in RequireStaffAuth) guards this the same
// way it always has -- list access itself requires view_candidates or
// manage_candidates on the backend (an OR of two permissions), which
// RequireStaffAuth's single-permission prop can't express, so this
// deliberately doesn't add one: an unauthorized staff member reaches the
// page and sees CandidateListWorkspace's own FORBIDDEN state instead,
// exactly like CandidateProfileCard and PaymentPanel already handle their
// own FORBIDDEN responses -- the backend remains the real boundary either
// way (AGENTS.md: "Frontend route guards are UX controls, not a security
// boundary").
export default function AdminCandidateListPage() {
  return (
    <StaffShell>
      <CandidateListWorkspace />
    </StaffShell>
  );
}
