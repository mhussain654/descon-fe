import { StaffShell } from "../../components/staff-shell";
import { WorkflowStageCallScriptList } from "../../../features/admin/workflowStageCallScripts/components/WorkflowStageCallScriptList";

// GET/PATCH /api/v1/admin/workflow_stage_call_scripts require
// manage_ai_call_scripts. StaffShell already wraps every staff screen in
// RequireStaffAuth with no permission (authentication only); a staff member
// lacking manage_ai_call_scripts reaches this page and sees
// WorkflowStageCallScriptList's own FORBIDDEN state instead -- same pattern
// as AdminAuditLogPage.
export default function AdminAiCallScriptsPage() {
  return (
    <StaffShell>
      <WorkflowStageCallScriptList />
    </StaffShell>
  );
}
