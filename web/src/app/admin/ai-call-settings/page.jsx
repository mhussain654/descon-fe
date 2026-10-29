import { Navigate } from "react-router";

// The call limits moved into the Settings page; old links land on its tab.
export default function AdminAiCallSettingsPage() {
  return <Navigate to="/admin/settings?tab=calls" replace />;
}
