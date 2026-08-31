import { Redirect } from "expo-router";
import type { ReactNode } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { RestoringScreen } from "./RestoringScreen";

/**
 * Guards candidate-only-when-signed-out screens (Welcome, Login). Mirrors
 * `RequireAuth`'s restoring/loading treatment so these routes never flash
 * before restoration resolves, and redirects straight to the authenticated
 * dashboard if a candidate with a valid restored session reaches Welcome or
 * Login through navigation history or a deep link -- these screens must
 * never be shown to an already-authenticated candidate.
 */
export function RequireGuest({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === "restoring") {
    return <RestoringScreen />;
  }

  if (status === "authenticated") {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return children;
}
