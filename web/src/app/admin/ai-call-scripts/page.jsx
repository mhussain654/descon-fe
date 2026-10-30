import { Navigate } from "react-router";

// Automatic calls moved into the Settings page; old links land on its tab.
export default function AdminAiCallScriptsPage() {
  return <Navigate to="/admin/settings?tab=automatic-calls" replace />;
}
