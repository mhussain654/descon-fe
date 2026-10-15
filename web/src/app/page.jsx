import { Navigate } from "react-router";

// The public landing page is intentionally not shown for now: the site's
// address opens the staff admin sign-in directly. An already-signed-in staff
// member is then forwarded to the portal by the sign-in page itself.
export default function HomePage() {
  return <Navigate to="/admin/login" replace />;
}
