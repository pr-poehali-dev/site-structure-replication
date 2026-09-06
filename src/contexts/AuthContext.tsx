import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import func2url from '../../backend/func2url.json';

const AUTH_URL = func2url['auth'];
const TOKEN_KEY = 'auth_token';

export interface UserProfile {
  id: number;
  last_name: string;
  first_name: string;
  middle_name: string | null;
  birth_date: string | null;
  fsr_id: string | null;
  coach_fio: string | null;
  institution: string | null;
  country_city: string | null;
  email: string;
  phone: string | null;
  created_at: string;
}

export interface RegisterPayload {
  last_name: string;
  first_name: string;
  middle_name?: string;
  birth_date?: string;
  fsr_id?: string;
  coach_fio?: string;
  institution?: string;
  country_city?: string;
  email: string;
  phone?: string;
  password: string;
}

interface AuthContextValue {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  register: (payload: RegisterPayload) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => void;
  updateProfile: (payload: Partial<RegisterPayload>) => Promise<{ ok: true } | { ok: false; error: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) {
      setLoading(false);
      return;
    }
    fetch(AUTH_URL, { headers: { 'X-Auth-Token': t } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { setUser(data.user); setToken(t); })
      .catch(() => { localStorage.removeItem(TOKEN_KEY); setUser(null); setToken(null); })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _action: 'login', email, password }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false as const, error: data.error || 'Ошибка входа' };
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    return { ok: true as const };
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const res = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _action: 'register', ...payload }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false as const, error: data.error || 'Ошибка регистрации' };
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    return { ok: true as const };
  }, []);

  const logout = useCallback(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) {
      fetch(AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _action: 'logout' }),
      }).catch(() => {});
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (payload: Partial<RegisterPayload>) => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) return { ok: false as const, error: 'Не авторизован' };
    const res = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': t },
      body: JSON.stringify({ _action: 'update_profile', ...payload }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false as const, error: data.error || 'Не удалось сохранить профиль' };
    setUser(data.user);
    return { ok: true as const };
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
