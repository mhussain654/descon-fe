import { Redirect } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { RestoringScreen } from "../features/auth/RestoringScreen";

/**
 * App-entry routing (MPS-F204). `status` starts as `'restoring'` while
 * AuthContext's SecureStore read is in flight -- this must not render (or
 * briefly flash) Welcome, Login or protected tabs during that window. Once
 * resolved, a candidate with a valid restored session goes straight to the
 * dashboard; otherwise to Welcome.
 */
export default function Index() {
  const { status } = useAuth();

  if (status === "restoring") {
    return <RestoringScreen />;
  }

  if (status === "authenticated") {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return <Redirect href="/welcome" />;
}
