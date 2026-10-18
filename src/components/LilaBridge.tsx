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
const REFRESH_INTERVAL_MS = 60 * 1000;
const MIN_GAP_MS = 30 * 1000;

export default function LilaBridge() {
  const { token } = useAuth();
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const lastSyncAt = useRef(0);

  useEffect(() => {
    if (!token) {
      lastSyncAt.current = 0;
      return;
    }

    const sync = () => {
      lastSyncAt.current = Date.now();
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
        .catch(() => { lastSyncAt.current = 0; });
    };

    const first = setTimeout(sync, 2500);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') sync();
    }, REFRESH_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastSyncAt.current > MIN_GAP_MS) sync();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearTimeout(first);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
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
