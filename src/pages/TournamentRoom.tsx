import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Header, Footer } from '@/components/Layout';
import Seo from '@/components/Seo';
import Icon from '@/components/ui/icon';
import LilaStandings from '@/components/LilaStandings';
import { useAuth } from '@/contexts/AuthContext';
import func2url from '../../backend/func2url.json';

const PUBLIC_URL = func2url['tournaments-public'];
const LILA_SYNC_URL = func2url['lila-sync'];
const LILA_ORIGIN = 'https://play.мир-шахмат.рф';

interface RoomTournament {
  id: number;
  title: string;
  date: string | null;
  time_control: string | null;
  lila_tournament_id: string | null;
  lila_tournament_kind: string;
}

export default function TournamentRoom() {
  const { tournamentId } = useParams();
  const [tournament, setTournament] = useState<RoomTournament | null>(null);
  const [loading, setLoading] = useState(true);
  const { token, loading: authLoading } = useAuth();
  const [joinSrc, setJoinSrc] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (authLoading || !tournamentId) return;
    if (!token) {
      setJoined(true);
      return;
    }
    let cancelled = false;
    const headers = { 'Content-Type': 'application/json', 'X-Auth-Token': token };
    const post = (body: object) =>
      fetch(LILA_SYNC_URL, { method: 'POST', headers, body: JSON.stringify(body) }).then(r => (r.ok ? r.json() : Promise.reject()));
    post({ _action: 'ensure_account' })
      .then(() => post({ _action: 'issue_tournament_token', tournament_id: Number(tournamentId) }))
      .then(d => {
        if (cancelled) return;
        if (d.bridge_token) setJoinSrc(`${LILA_ORIGIN}/bridge/login?token=${d.bridge_token}`);
        else setJoined(true);
      })
      .catch(() => { if (!cancelled) setJoined(true); });
    const fallback = setTimeout(() => { if (!cancelled) setJoined(true); }, 12000);
    return () => { cancelled = true; clearTimeout(fallback); };
  }, [token, authLoading, tournamentId]);

  useEffect(() => {
    fetch(PUBLIC_URL)
      .then(r => r.json())
      .then(d => setTournament((d.tournaments || []).find((t: RoomTournament) => String(t.id) === tournamentId) || null))
      .catch(() => setTournament(null))
      .finally(() => setLoading(false));
  }, [tournamentId]);

  const lilaId = tournament?.lila_tournament_id;
  const isArena = tournament?.lila_tournament_kind === 'arena';
  const kind = isArena ? 'tournament' : 'swiss';

  return (
    <div className="min-h-screen bg-muted flex flex-col">
      <Seo title={tournament ? `${tournament.title} — турнирный зал` : 'Турнирный зал'} description="Турнирный зал" noindex />
      <Header />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-heading font-bold text-2xl text-primary">{tournament?.title || 'Турнирный зал'}</h1>
            {tournament?.time_control && <p className="text-sm text-muted-foreground">{tournament.time_control}</p>}
          </div>
          <Link to="/cabinet" className="text-sm text-primary hover:underline flex items-center gap-1">
            <Icon name="ArrowLeft" size={14} /> В кабинет
          </Link>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground py-6">
            <Icon name="Loader2" size={20} className="animate-spin" /> Загрузка...
          </div>
        )}

        {!loading && !lilaId && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-gray-500">
            Для этого турнира зал ещё не готов. Загляните чуть позже.
          </div>
        )}

        {lilaId && !joined && (
          <div className="flex items-center gap-2 text-muted-foreground py-6">
            <Icon name="Loader2" size={20} className="animate-spin" /> Подключаем вас к турниру...
          </div>
        )}

        {joinSrc && !joined && (
          <iframe
            src={joinSrc}
            title="lila-join"
            style={{ display: 'none', width: 0, height: 0, border: 0 }}
            onLoad={() => setJoined(true)}
          />
        )}

        {lilaId && joined && (
          <>
            <iframe
              src={`${LILA_ORIGIN}/${kind}/${lilaId}?embed=1`}
              title="Турнир"
              className="w-full bg-white"
              style={{ height: '85vh', minHeight: 600, border: '1px solid #E5E2DC', borderRadius: 12 }}
              allow="fullscreen"
            />
            <LilaStandings tournamentId={lilaId} kind={kind} />
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
