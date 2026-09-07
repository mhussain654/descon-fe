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
  const { status, session } = useAuth();

  if (status === "restoring") {
    return <RestoringScreen />;
  }

  if (status !== "authenticated") {
    return <Redirect href="/login" />;
  }

  // MPS-204: every candidate screen except the consent screen itself is
  // gated on having accepted the current policy version -- mirrors the
  // backend's ProtectedController#ensure_consent_given!.
  if (!session?.consent?.accepted) {
    return <Redirect href="/consent" />;
  }

  return children;
}
