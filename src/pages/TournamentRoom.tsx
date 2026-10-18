import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { Header, Footer } from '@/components/Layout';
import Seo from '@/components/Seo';
import Icon from '@/components/ui/icon';
import LilaStandings from '@/components/LilaStandings';
import AgeGroupTables from '@/components/AgeGroupTables';
import { useAuth } from '@/contexts/AuthContext';
import func2url from '../../backend/func2url.json';

const PUBLIC_URL = func2url['tournaments-public'];
const LILA_SYNC_URL = func2url['lila-sync'];
const MIN_FRAME_HEIGHT = 400;
const MAX_FRAME_HEIGHT = 5000;
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
  const [liveGame, setLiveGame] = useState<string | null>(null);
  const [frameHeight, setFrameHeight] = useState<number | null>(null);
  const [, setSearchParams] = useSearchParams();
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const currentHeight = useRef<number | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== new URL(LILA_ORIGIN).origin) return;
      if (!frameRef.current || e.source !== frameRef.current.contentWindow) return;
      const d = e.data;
      if (d && d.type === 'lila-open-game' && typeof d.gameId === 'string' && /^[A-Za-z0-9]{8}$/.test(d.gameId)) {
        setSearchParams(prev => {
          const next = new URLSearchParams(prev);
          next.set('game', d.gameId);
          return next;
        }, { replace: true });
        return;
      }
      if (d && d.type === 'lila-embed-height' && typeof d.height === 'number' && d.height > 0) {
        const next = Math.min(Math.max(Math.ceil(d.height), MIN_FRAME_HEIGHT), MAX_FRAME_HEIGHT);
        const current = currentHeight.current;
        if (pendingTimer.current) {
          clearTimeout(pendingTimer.current);
          pendingTimer.current = null;
        }
        if (current !== null && (next > current * 2 || next < current / 2)) {
          pendingTimer.current = setTimeout(() => {
            pendingTimer.current = null;
            currentHeight.current = next;
            setFrameHeight(next);
          }, 1500);
          return;
        }
        currentHeight.current = next;
        setFrameHeight(next);
      }
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
    };
  }, []);

  useEffect(() => {
    if (authLoading || !tournamentId) return;
    if (!token) {
      setJoined(true);
      return;
    }
    let cancelled = false;
    const headers = { 'Content-Type': 'application/json', 'X-Auth-Token': token };
    const post = (body: { _action: string; tournament_id?: number }) =>
      fetch(LILA_SYNC_URL, { method: 'POST', headers, body: JSON.stringify(body) }).then(async r => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          console.warn('lila-sync', body._action, r.status, data);
          return Promise.reject(data);
        }
        return data;
      });
    post({ _action: 'ensure_account' })
      .then(() => post({ _action: 'issue_tournament_token', tournament_id: Number(tournamentId) }))
      .then(d => {
        if (cancelled) return;
        if (d.bridge_token) setJoinSrc(`${LILA_ORIGIN}/bridge/login?token=${d.bridge_token}`);
        else setJoined(true);
      })
      .catch(e => { console.warn('lila join failed', e); if (!cancelled) setJoined(true); });
    const fallback = setTimeout(() => { if (!cancelled) setJoined(true); }, 12000);
    return () => { cancelled = true; clearTimeout(fallback); };
  }, [token, authLoading, tournamentId]);

  useEffect(() => {
    fetch(`${PUBLIC_URL}?id=${encodeURIComponent(tournamentId || '')}`)
      .then(r => r.json())
      .then(d => setTournament((d.tournaments || []).find((t: RoomTournament) => String(t.id) === tournamentId) || null))
      .catch(() => setTournament(null))
      .finally(() => setLoading(false));
  }, [tournamentId]);

  const lilaId = tournament?.lila_tournament_id;
  const isArena = tournament?.lila_tournament_kind === 'arena';
  const kind = isArena ? 'tournament' : 'swiss';

  const headerBlock = (
    <div className="flex items-center justify-between gap-3 flex-wrap pt-6">
      <div>
        <h1 className="font-heading font-bold text-2xl text-primary">{tournament?.title || 'Турнирный зал'}</h1>
        {tournament?.time_control && <p className="text-sm text-muted-foreground">{tournament.time_control}</p>}
      </div>
      <Link to="/cabinet" className="text-sm text-primary hover:underline flex items-center gap-1">
        <Icon name="ArrowLeft" size={14} /> В кабинет
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted flex flex-col">
      <Seo title={tournament ? `${tournament.title} — турнирный зал` : 'Турнирный зал'} description="Турнирный зал" noindex />
      <Header />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 pb-6 pt-0 flex flex-col gap-5">
        {!(lilaId && joined) && headerBlock}

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
            {liveGame && (
              <button
                type="button"
                onClick={() => setLiveGame(null)}
                className="self-start inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <Icon name="ArrowLeft" size={14} /> Вернуться к турниру
              </button>
            )}
            <iframe
              key={liveGame || 'tour'}
              ref={frameRef}
              src={liveGame ? `${LILA_ORIGIN}/${liveGame}?embed=1` : `${LILA_ORIGIN}/${kind}/${lilaId}?embed=1`}
              title="Турнир"
              className="w-full bg-white"
              scrolling="no"
              style={{
                height: liveGame ? '70vh' : (frameHeight ?? '113vh'),
                minHeight: liveGame ? 480 : (frameHeight ? undefined : 800),
                border: '1px solid #E5E2DC',
                borderRadius: 12,
                overflow: 'hidden',
              }}
              allow="fullscreen"
            />
            {headerBlock}
            <LilaStandings tournamentId={lilaId} kind={kind} onLiveGame={id => { setLiveGame(id); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
            <AgeGroupTables tournamentId={tournamentId || ''} />
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}