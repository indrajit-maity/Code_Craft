import type { ReactNode } from "react";
import { useAuthRedirect } from "../hooks/useAuthRedirect";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded } = useAuthRedirect();

  // Mirrors the zip's page.tsx pattern: render nothing until we know the auth state,
  // and nothing while redirecting an unauthenticated user away.
  if (!isLoaded || !isSignedIn) {
    return null;
  }

  return <>{children}</>;
}
