import { StaffShell } from "../../../components/staff-shell";
import { BulkCallBatchDetail } from "../../../../features/admin/bulkCalls/components/BulkCallBatchDetail";

export default function AdminBulkCallDetailPage({ params }) {
  return (
    <StaffShell>
      <BulkCallBatchDetail key={params.id} batchId={params.id} />
    </StaffShell>
  );
}
