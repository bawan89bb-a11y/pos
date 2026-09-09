import { createContext, useContext, useState, type ReactNode } from "react";
import { trpc } from "../trpc";
import type { UserRecord } from "@thoth/shared";

interface AuthContextValue {
  user: UserRecord | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loginError: string | null;
  clearLoginError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery(undefined, { staleTime: Infinity });
  const [loginError, setLoginError] = useState<string | null>(null);
  const loginMutation = trpc.auth.login.useMutation();
  const logoutMutation = trpc.auth.logout.useMutation();

  async function login(username: string, password: string) {
    setLoginError(null);
    try {
      const user = await loginMutation.mutateAsync({ username, password });
      utils.auth.me.setData(undefined, user as UserRecord);
    } catch (err: any) {
      setLoginError(err?.message ?? "Incorrect username or password");
      throw err;
    }
  }

  async function logout() {
    try {
      await logoutMutation.mutateAsync();
    } finally {
      utils.auth.me.setData(undefined, null);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user: (meQuery.data as UserRecord | null | undefined) ?? null,
        loading: meQuery.isLoading,
        login,
        logout,
        loginError,
        clearLoginError: () => setLoginError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
