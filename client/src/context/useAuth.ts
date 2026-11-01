import { createContext, useContext } from "react";

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  plan: "FREE" | "PRO";
}

export interface AuthContextValue {
  user: User | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  loginWithGithub: () => void;
  handleOAuthToken: (token: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined
);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}