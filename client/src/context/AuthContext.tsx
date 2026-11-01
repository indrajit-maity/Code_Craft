import { useEffect, useState, type ReactNode } from "react";
import axiosClient, { API_URL } from "../lib/axiosClient";
import { AuthContext, type User } from "./useAuth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  // If there's no token, we're already "loaded" on the first render
  const [isLoaded, setIsLoaded] = useState(
    () => !localStorage.getItem("accessToken")
  );

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    const initializeAuth = async () => {
      try {
        const response = await axiosClient.get("/api/auth/me");
        setUser(response.data);
      } catch {
        localStorage.removeItem("accessToken");
        setUser(null);
      } finally {
        setIsLoaded(true);
      }
    };

    initializeAuth();
  }, []);

  async function login(email: string, password: string) {
    const res = await axiosClient.post("/api/auth/login", { email, password });
    localStorage.setItem("accessToken", res.data.accessToken);
    setUser(res.data.user);
  }

  async function register(name: string, email: string, password: string) {
    const res = await axiosClient.post("/api/auth/register", {
      name,
      email,
      password,
    });
    localStorage.setItem("accessToken", res.data.accessToken);
    setUser(res.data.user);
  }

  function loginWithGithub() {
    window.location.href = `${API_URL}/api/auth/github`;
  }

  async function handleOAuthToken(token: string) {
    localStorage.setItem("accessToken", token);
    const res = await axiosClient.get("/api/auth/me");
    setUser(res.data); // see note below
  }

  function logout() {
    localStorage.removeItem("accessToken");
    setUser(null);
    axiosClient.post("/api/auth/logout").catch(() => {});
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoaded,
        isSignedIn: !!user,
        login,
        register,
        loginWithGithub,
        handleOAuthToken,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}