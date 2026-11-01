import { useAuth } from "../context/useAuth";
import { Button } from "../components/ui/button";

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <Button variant="outline" onClick={logout}>
          Log out
        </Button>
      </div>
      <p className="text-muted-foreground">
        Signed in as {user?.email} — plan: {user?.plan}
      </p>
    </div>
  );
}
