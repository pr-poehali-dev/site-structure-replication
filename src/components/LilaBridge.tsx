import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import func2url from '../../backend/func2url.json';

const LILA_SYNC_URL = func2url['lila-sync'];
// Поддомен на VPS, где стоит мост тихой авторизации рядом с Lila (world-chess.ru) —
// см. vps-bridge/bridge.py и vps-bridge/nginx-bridge.conf.example. ВАЖНО: домен должен
// совпадать с корневым доменом сайта (мир-шахмат.рф), иначе браузер не даст мосту
// установить cookie, видимую нашему сайту.
const LILA_BRIDGE_ORIGIN = 'https://play.мир-шахмат.рф';

/**
 * Невидимый компонент: после входа пользователя на сайт незаметно открывает
 * iframe на play.мир-шахмат.рф/bridge/login, который логинит пользователя в
 * зеркальный Lila-аккаунт и выставляет ему настоящую cookie сессии Lila на
 * этом поддомене — дальше турниры/партии в iframe открываются уже
 * авторизованными, без отдельного входа на world-chess.ru.
 *
 * Рендерить один раз в корне приложения (см. App.tsx), рядом с AuthProvider.
 */
export default function LilaBridge() {
  const { token } = useAuth();
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const lastSyncedToken = useRef<string | null>(null);

  useEffect(() => {
    if (!token || token === lastSyncedToken.current) return;
    lastSyncedToken.current = token;

    // Небольшая задержка: AuthContext параллельно вызывает ensure_account (создание
    // зеркального Lila-аккаунта) сразу после входа — issue_bridge_token требует, чтобы
    // аккаунт уже существовал, поэтому даём первому запросу время отработать. Если
    // аккаунт ещё не готов (400 от backend), просто не показываем мост в этот раз —
    // при следующем входе/обновлении страницы попытка повторится.
    const timer = setTimeout(() => {
      fetch(LILA_SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token },
        body: JSON.stringify({ _action: 'issue_bridge_token' }),
      })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => {
          if (data.bridge_token) {
            setIframeSrc(`${LILA_BRIDGE_ORIGIN}/bridge/login?token=${data.bridge_token}`);
          }
        })
        .catch(() => {});
    }, 2500);

    return () => clearTimeout(timer);
  }, [token]);

  if (!iframeSrc) return null;

  return (
    <iframe
      src={iframeSrc}
      title="lila-bridge"
      style={{ display: 'none', width: 0, height: 0, border: 0 }}
      onLoad={() => setIframeSrc(null)}
    />
  );
}