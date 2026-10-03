import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/contexts/AuthContext';
import func2url from '../../../backend/func2url.json';

const LILA_SYNC_URL = func2url['lila-sync'];
const LILA_BRIDGE_ORIGIN = 'https://play.мир-шахмат.рф';

export default function LilaTournamentButton({ tournamentId }: { tournamentId: number }) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleEnter() {
    if (!token || loading) return;
    setLoading(true);
    setError('');
    const win = window.open('about:blank', '_blank');
    const headers = { 'Content-Type': 'application/json', 'X-Auth-Token': token };
    const fail = (msg: string) => {
      win?.close();
      setError(msg);
    };
    try {
      const ensureRes = await fetch(LILA_SYNC_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ _action: 'ensure_account' }),
      });
      const ensure = await ensureRes.json();
      if (!ensureRes.ok || ensure.ok === false) {
        fail('Не удалось подготовить игровой аккаунт. Попробуйте ещё раз чуть позже.');
        return;
      }
      const res = await fetch(LILA_SYNC_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ _action: 'issue_tournament_token', tournament_id: tournamentId }),
      });
      const data = await res.json();
      if (res.ok && data.bridge_token && win) {
        win.location.href = `${LILA_BRIDGE_ORIGIN}/bridge/login?token=${data.bridge_token}&redirect=1`;
      } else {
        fail(data.error || 'Не удалось открыть турнир. Попробуйте ещё раз.');
      }
    } catch {
      fail('Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-5 pb-4 flex flex-col gap-2">
      <button
        type="button"
        onClick={handleEnter}
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary text-secondary-foreground font-semibold text-sm px-4 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-60 w-full sm:w-auto"
      >
        <Icon name={loading ? 'Loader' : 'Swords'} size={16} className={loading ? 'animate-spin' : ''} />
        Войти в турнир
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
