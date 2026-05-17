import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: number;
  name: string;
  email: string;
  gender: number;
  phone: string | null;
  amountspent: number;
  revenue: number;
  is_admin: number;
  profile_photo: string | null;
  preferences: string | null;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (data: { name: string; email: string; password: string; gender: boolean; phone: string; preferences?: string }) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('verdant_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      setUser(parsed);
      fetch(`/api/user/${parsed.id}`).then(r => r.ok ? r.json() : null).then(fresh => {
        if (fresh) { setUser(fresh); localStorage.setItem('verdant_user', JSON.stringify(fresh)); }
      }).catch(() => {});
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        localStorage.setItem('verdant_user', JSON.stringify(data));
        return true;
      }
    } catch (e) {
      console.error("Login error:", e);
    }
    return false;
  };

  const register = async (data: { name: string; email: string; password: string; gender: boolean; phone: string; preferences?: string }) => {
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const userData = await res.json();
        const mapped = { id: userData.id, name: userData.cname, email: userData.email, gender: userData.gender, phone: userData.pno, amountspent: userData.amountspent, revenue: userData.revenue, is_admin: userData.is_admin || 0, profile_photo: userData.profile_photo || null, preferences: userData.preferences || null };
        setUser(mapped);
        localStorage.setItem('verdant_user', JSON.stringify(mapped));
        return true;
      }
    } catch (e) {
      console.error("Register error:", e);
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('verdant_user');
  };

  const refreshUser = async () => {
    if (user) {
      try {
        const res = await fetch(`/api/user/${user.id}`);
        if (res.ok) {
          const data = await res.json();
          setUser(data);
          localStorage.setItem('verdant_user', JSON.stringify(data));
        }
      } catch {}
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
