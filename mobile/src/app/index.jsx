import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { takeLanguageResumeRoute } from "../contexts/LanguageContext";
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
  // Switching between English and Urdu reloads the app; the screen that asked
  // for the switch (sign-in, consent, profile) is reopened instead of the start.
  const [resumeRoute, setResumeRoute] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    takeLanguageResumeRoute().then((route) => {
      if (!cancelled) setResumeRoute(route);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "restoring" || resumeRoute === undefined) {
    return <RestoringScreen />;
  }

  if (status === "authenticated") {
    const signedInRoute = resumeRoute && resumeRoute !== "/login" ? resumeRoute : null;
    return <Redirect href={signedInRoute ?? "/(tabs)/dashboard"} />;
  }

  return <Redirect href={resumeRoute === "/login" ? "/login" : "/welcome"} />;
}
