import { Redirect } from "expo-router";
import type { ReactNode } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { RestoringScreen } from "./RestoringScreen";

/**
 * Guards candidate-only screens. `status` starts as `'restoring'` while the
 * secure-store session read is in flight (see AuthContext) -- protected
 * content must not render during that window either, so this shows a
 * loading state instead of flashing the login screen or (worse) stale
 * protected content before authorization is confirmed.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === "restoring") {
    return <RestoringScreen />;
  }

  if (status !== "authenticated") {
    return <Redirect href="/login" />;
  }

  return children;
}
