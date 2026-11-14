import { StaffShell } from "../../components/staff-shell";
import { RequireStaffAuth } from "../../../features/staffAuth/RequireStaffAuth";
import { JobLogList } from "../../../features/admin/jobLogs/components/JobLogList";

// Developer-only: GET /api/v1/admin/job_logs requires view_job_logs, which
// only the developer role has. Anyone else is sent to /admin/forbidden.
export default function AdminJobLogsPage() {
  return (
    <StaffShell>
      <RequireStaffAuth permission="view_job_logs">
        <JobLogList />
      </RequireStaffAuth>
    </StaffShell>
  );
}
