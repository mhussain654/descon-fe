import { StaffShell } from "../../components/staff-shell";
import { RequireStaffAuth } from "../../../features/staffAuth/RequireStaffAuth";
import { ReferenceDataWorkspace } from "../../../features/admin/referenceData/components/ReferenceDataWorkspace";

// Developer-only: the reference data management endpoints require
// manage_reference_data, which only the developer role has. Anyone else is
// sent to /admin/forbidden.
export default function AdminReferenceDataPage() {
  return (
    <StaffShell>
      <RequireStaffAuth permission="manage_reference_data">
        <ReferenceDataWorkspace />
      </RequireStaffAuth>
    </StaffShell>
  );
}
