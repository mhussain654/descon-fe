import { StaffShell } from "../../../components/staff-shell";
import { PaymentTransactionList } from "../../../../features/admin/payments/components/PaymentTransactionList";

// GET /api/v1/admin/payments requires view_payments OR manage_payments (an
// OR of two permissions), which RequireStaffAuth's single-permission prop
// can't express -- same rationale as AdminCandidateListPage (web/src/app/
// admin/page.jsx). StaffShell already wraps every staff screen in
// RequireStaffAuth with no permission (authentication only); an
// unauthorized staff member reaches this page and sees
// PaymentTransactionList's own FORBIDDEN state instead.
export default function AdminFinancePaymentsPage() {
  return (
    <StaffShell>
      <PaymentTransactionList />
    </StaffShell>
  );
}
