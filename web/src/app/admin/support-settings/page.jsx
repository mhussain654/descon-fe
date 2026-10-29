import { Navigate } from "react-router";

// The support number moved into the Settings page; old links land on its tab.
export default function AdminSupportSettingsPage() {
  return <Navigate to="/admin/settings?tab=support" replace />;
}
