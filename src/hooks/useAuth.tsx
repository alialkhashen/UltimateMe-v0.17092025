// src/hooks/useAuth.tsx
// Fake authentication hook to bypass Supabase login completely

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type FakeUser = {
  id: string;
  email?: string;
};

type AuthContextType = {
  user: FakeUser | null;
  signOut: () => Promise<void>;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FakeUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 🟢 Always treat as logged in
    setUser({ id: "demo-user", email: "demo@example.com" });
    setLoading(false);
  }, []);

  const signOut = async () => {
    // Just reset user to null if you want a "logout" button to work
    setUser({ id: "demo-user", email: "demo@example.com" });
  };

  return (
    <AuthContext.Provider value={{ user, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
