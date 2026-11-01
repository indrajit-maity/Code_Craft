import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/useAuth";

// The backend's GitHub OAuth callback redirects here as:
//   /oauth/callback?token=<jwt>
// after it has already found-or-created the user and issued our own JWT.
export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const { handleOAuthToken } = useAuth();
  const navigate = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const token = searchParams.get("token");
    if (!token) {
      navigate("/sign-in?error=oauth_failed");
      return;
    }

    handleOAuthToken(token)
      .then(() => navigate("/dashboard"))
      .catch(() => navigate("/sign-in?error=oauth_failed"));
  }, [searchParams, handleOAuthToken, navigate]);

  return (
    <p className="text-sm text-muted-foreground">Signing you in...</p>
  );
}
