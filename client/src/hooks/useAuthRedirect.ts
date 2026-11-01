import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { ROUTES } from "../lib/constants";

export function useAuthRedirect() {
  const { isSignedIn, isLoaded } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      navigate(ROUTES.HOME);
    }
  }, [isLoaded, isSignedIn, navigate]);

  return { isSignedIn, isLoaded };
}
