import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import func2url from '../../backend/func2url.json';

const AUTH_URL = func2url['auth'];
const LILA_SYNC_URL = func2url['lila-sync'];
const TOKEN_KEY = 'auth_token';
const ORIGINAL_TOKEN_KEY = 'auth_token_original';
const LILA_BRIDGE_LOGOUT_URL = 'https://play.мир-шахмат.рф/bridge/logout';

function logoutFromLila() {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'display:none;width:0;height:0;border:0';
  frame.title = 'lila-logout';
  const cleanup = () => frame.remove();
  frame.onload = cleanup;
  setTimeout(cleanup, 8000);
  frame.src = `${LILA_BRIDGE_LOGOUT_URL}?t=${Date.now()}`;
  document.body.appendChild(frame);
}

// Фоновая синхронизация с зеркальным аккаунтом world-chess.ru — вызывается после
// login/register и НЕ блокирует вход на сайт: пользователь продолжает работать сразу,
// а создание/проверка Lila-аккаунта идёт в фоне. Ошибка намеренно проглатывается —
// на UX нашего сайта она никак не должна влиять, попытка повторится при следующем входе.
function syncLilaAccount(token: string, password?: string) {
  fetch(LILA_SYNC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token },
    body: JSON.stringify({ _action: 'ensure_account', password }),
  }).catch(() => {});
}

export interface UserProfile {
  id: number;
  last_name: string;
  first_name: string;
  middle_name: string | null;
  birth_date: string | null;
  gender?: 'M' | 'F' | null;
  fsr_id: string | null;
  coach_fio: string | null;
  institution: string | null;
  country_city: string | null;
  email: string;
  login: string | null;
  phone: string | null;
  created_at: string;
  avatar_url: string | null;
  rating_blitz: number | null;
  rating_rapid: number | null;
  fsr_rating_blitz: number | null;
  fsr_rating_rapid: number | null;
  bonus_balance?: number;
  referral_code?: string;
}

export interface RegisterPayload {
  last_name: string;
  first_name: string;
  middle_name?: string;
  birth_date?: string;
  gender?: 'M' | 'F' | '';
  fsr_id?: string;
  coach_fio?: string;
  institution?: string;
  country_city?: string;
  email: string;
  login: string;
  phone?: string;
  password: string;
  website?: string;
  elapsed_ms?: number;
  ref_code?: string;
}

interface AuthContextValue {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  impersonating: boolean;
  startImpersonation: (userId: number) => Promise<{ ok: true } | { ok: false; error: string }>;
  stopImpersonation: () => void;
  login: (identifier: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  register: (payload: RegisterPayload) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => void;
  updateProfile: (payload: Partial<RegisterPayload>) => Promise<{ ok: true } | { ok: false; error: string }>;
  uploadAvatar: (photoBase64: string, contentType: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);
  const [impersonating, setImpersonating] = useState(() => !!localStorage.getItem(ORIGINAL_TOKEN_KEY));

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) {
      setLoading(false);
      return;
    }
    fetch(AUTH_URL, { headers: { 'X-Auth-Token': t } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { setUser(data.user); setToken(t); if (!localStorage.getItem(ORIGINAL_TOKEN_KEY)) syncLilaAccount(t); })
      .catch(() => { localStorage.removeItem(TOKEN_KEY); setUser(null); setToken(null); })
      .finally(() => setLoading(false));
  }, []);

  // Периодический сигнал "пользователь на сайте" — пока открыта вкладка авторизованного
  // пользователя, раз в 2 минуты обновляем отметку "последний раз онлайн" для раздела
  // "Логи" в админке. Без heartbeat статус "онлайн" определялся бы только по моментам
  // входа/выхода и был бы неточным для долгих сессий на сайте.
  useEffect(() => {
    if (!token || impersonating) return;
    const ping = () => {
      fetch(AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token },
        body: JSON.stringify({ _action: 'heartbeat' }),
      }).catch(() => {});
    };
    ping();
    const interval = setInterval(ping, 120000);
    return () => clearInterval(interval);
  }, [token, impersonating]);

  const login = useCallback(async (identifier: string, password: string) => {
    const res = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _action: 'login', login: identifier, password }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false as const, error: data.error || 'Ошибка входа' };
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    syncLilaAccount(data.token, password);
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
    syncLilaAccount(data.token, payload.password);
    return { ok: true as const };
  }, []);

  const startImpersonation = useCallback(async (userId: number) => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) return { ok: false as const, error: 'Не авторизован' };
    const res = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': t },
      body: JSON.stringify({ _action: 'impersonate', user_id: userId }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false as const, error: data.error || 'Не удалось войти' };
    if (!localStorage.getItem(ORIGINAL_TOKEN_KEY)) localStorage.setItem(ORIGINAL_TOKEN_KEY, t);
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    setImpersonating(true);
    return { ok: true as const };
  }, []);

  const stopImpersonation = useCallback(() => {
    const orig = localStorage.getItem(ORIGINAL_TOKEN_KEY);
    const cur = localStorage.getItem(TOKEN_KEY);
    if (!orig) return;
    if (cur) {
      fetch(AUTH_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Auth-Token': cur }, body: JSON.stringify({ _action: 'silent_logout' }) }).catch(() => {});
    }
    localStorage.removeItem(ORIGINAL_TOKEN_KEY);
    localStorage.setItem(TOKEN_KEY, orig);
    window.location.href = '/cabinet';
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(ORIGINAL_TOKEN_KEY);
    setImpersonating(false);
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) {
      fetch(AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Auth-Token': t },
        body: JSON.stringify({ _action: 'logout' }),
      }).catch(() => {});
    }
    logoutFromLila();
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

  const uploadAvatar = useCallback(async (photoBase64: string, contentType: string) => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) return { ok: false as const, error: 'Не авторизован' };
    const res = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': t },
      body: JSON.stringify({ _action: 'upload_avatar', photo_b64: photoBase64, content_type: contentType }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false as const, error: data.error || 'Не удалось загрузить фото' };
    setUser(data.user);
    return { ok: true as const };
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, impersonating, startImpersonation, stopImpersonation, login, register, logout, updateProfile, uploadAvatar }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}