import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type UserRole = "admin" | "user";

interface AuthUser {
  username: string;
  role: UserRole;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (username: string, password?: string) => { success: boolean; error?: string };
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_USERNAME = "Admin";
const ADMIN_PASSWORD = "180519";
const STORAGE_KEY = "inventory_auth_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = (username: string, password?: string): { success: boolean; error?: string } => {
    const trimmed = username.trim();
    if (!trimmed) return { success: false, error: "กรุณากรอกชื่อผู้ใช้" };

    if (trimmed === ADMIN_USERNAME) {
      if (password !== ADMIN_PASSWORD) {
        return { success: false, error: "รหัสผ่าน Admin ไม่ถูกต้อง" };
      }
      const adminUser: AuthUser = { username: trimmed, role: "admin" };
      setUser(adminUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(adminUser));
      return { success: true };
    }

    // Regular user - no password needed
    const regularUser: AuthUser = { username: trimmed, role: "user" };
    setUser(regularUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(regularUser));
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
