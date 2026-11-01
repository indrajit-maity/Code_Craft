import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { Button } from "../components/ui/button";

export default function Landing() {
  const { isSignedIn, isLoaded } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate("/dashboard");
    }
  }, [isLoaded, isSignedIn, navigate]);

  if (!isLoaded || isSignedIn) {
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6">
      <h1 className="text-2xl font-semibold">CodeReview</h1>
      <p className="text-muted-foreground">AI-powered code reviews for GitHub.</p>
      <div className="flex gap-4">
        <Link to="/sign-in">
          <Button variant="outline" size="lg">
            Sign In
          </Button>
        </Link>
        <Link to="/sign-up">
          <Button variant="default" size="lg">
            Sign Up
          </Button>
        </Link>
      </div>
    </div>
  );
}
