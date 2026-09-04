import { StaffShell } from "../../../../components/staff-shell";
import { PaymentDetail } from "../../../../../features/admin/payments/components/PaymentDetail";

// Same rationale as the list route (page.jsx in this directory) -- GET
// /api/v1/admin/payments/{id} requires view_payments OR manage_payments,
// so this relies on PaymentDetail's own FORBIDDEN state rather than a
// RequireStaffAuth permission prop. The correction action itself is gated
// separately, inside PaymentDetail, on manage_payments specifically.
export default function AdminFinancePaymentDetailPage({ params }) {
  return (
    <StaffShell>
      <PaymentDetail paymentId={params.id} />
    </StaffShell>
  );
}
