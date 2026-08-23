import { useNavigate } from "react-router";
import { StaffShell } from "../../components/staff-shell";
import { useLanguage } from "../../../contexts/LanguageContext";
import { ForbiddenState } from "../../../design-system";

// Reached only by an *authenticated* staff member redirected here by
// RequireStaffAuth's permission check -- StaffShell's own guard (auth only,
// no permission requirement) still bounces an unauthenticated visitor to
// /admin/login first, so this never has to explain the permission system to
// someone who isn't signed in at all.
export default function StaffForbiddenPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <StaffShell>
      <div className="mx-auto max-w-2xl px-6 py-16">
        <ForbiddenState
          title={t("dsForbiddenTitle")}
          description={t("dsForbiddenDescription")}
          actionLabel={t("adminBackToDashboard")}
          onAction={() => navigate("/admin")}
        />
      </div>
    </StaffShell>
  );
}
