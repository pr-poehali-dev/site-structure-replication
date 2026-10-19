import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import PlayerProfileModal from '@/components/PlayerProfileModal';
import PlayerAvatar from '@/components/PlayerAvatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MiniChessBoard from '@/components/MiniChessBoard';
import { shortFio } from '@/lib/fio';
import { useAuth } from '@/contexts/AuthContext';
import func2url from '../../backend/func2url.json';

const PLAYERS_URL = func2url['lila-players'];
const LILA_ORIGIN = 'https://play.мир-шахмат.рф';

interface LilaRow {
  rank: number;
  points: number;
  tieBreak: number;
  rating: number;
  username: string;
  performance?: number;
  absent?: boolean;
}

interface LilaGame {
  id: string;
  createdAt: number;
  status: string;
  lastFen?: string;
  winner?: 'white' | 'black';
  players: { white: { user?: { id: string } }; black: { user?: { id: string } } };
}

interface RoundCell {
  gameId: string;
  score: string;
  opponent: string;
  ongoing: boolean;
  bye?: boolean;
}

interface PlayerInfo {
  user_id: number;
  fio: string | null;
  avatar_url: string | null;
  rating_delta?: number | null;
  age?: number | null;
}

interface Props {
  tournamentId: string;
  kind?: 'swiss' | 'tournament';
  onLiveGame?: (gameId: string) => void;
  liveGame?: string | null;
  onLeaveGame?: () => void;
}

const parseNdjson = (text: string) =>
  text
    .split('\n')
    .filter(l => l.trim())
    .map(l => JSON.parse(l));

const safeParse = (text: string): LilaGame[] => {
  try {
    return parseNdjson(text);
  } catch {
    return [];
  }
};

const ONGOING = ['created', 'started'];

const ROUND_GAP_MS = 5000;

function buildRounds(games: LilaGame[], rows: LilaRow[], roundsCount: number) {
  const rankById = new Map(rows.map(r => [r.username.toLowerCase(), r.rank]));
  const cells = new Map<string, Record<number, RoundCell>>();
  const sorted = [...games].sort((a, b) => a.createdAt - b.createdAt);
  let maxRound = 0;
  let round = 0;
  let prev = 0;

  const put = (player: string, r: number, cell: RoundCell) => {
    const row = cells.get(player) || {};
    row[r] = cell;
    cells.set(player, row);
  };

  sorted.forEach(g => {
    if (round === 0 || g.createdAt - prev > ROUND_GAP_MS) round += 1;
    prev = g.createdAt;
    maxRound = Math.max(maxRound, round);
    const w = g.players.white.user?.id;
    const b = g.players.black.user?.id;
    if (!w || !b) return;
    const ongoing = ONGOING.includes(g.status);
    const wScore = ongoing ? '•' : g.winner === 'white' ? '1' : g.winner === 'black' ? '0' : '½';
    const bScore = ongoing ? '•' : g.winner === 'black' ? '1' : g.winner === 'white' ? '0' : '½';
    put(w, round, { gameId: g.id, score: wScore, opponent: String(rankById.get(b) ?? ''), ongoing });
    put(b, round, { gameId: g.id, score: bScore, opponent: String(rankById.get(w) ?? ''), ongoing });
  });

  const count = Math.max(roundsCount, maxRound);

  rows.forEach(r => {
    const key = r.username.toLowerCase();
    const row = cells.get(key) || {};
    let gamePoints = 0;
    Object.values(row).forEach(c => {
      if (c.score === '1') gamePoints += 1;
      else if (c.score === '½') gamePoints += 0.5;
    });
    let byes = Math.round(r.points - gamePoints);
    for (let n = 1; n <= count && byes > 0; n++) {
      if (!row[n]) {
        row[n] = { gameId: '', score: '1', opponent: '', ongoing: false, bye: true };
        byes -= 1;
      }
    }
    cells.set(key, row);
  });

  return { cells, count };
}

const scoreColor = (c: RoundCell) => {
  if (c.bye || c.ongoing || c.score === '½') return 'text-gray-900';
  return c.score === '1' ? 'text-emerald-600' : 'text-red-500';
};

function buildFromSheets(sheets: Record<string, string[]>, games: LilaGame[], rows: LilaRow[]) {
  const rankById = new Map(rows.map(r => [r.username.toLowerCase(), r.rank]));
  const byGame = new Map(games.map(g => [g.id, g]));
  const cells = new Map<string, Record<number, RoundCell>>();
  let count = 0;
  Object.entries(sheets).forEach(([player, tokens]) => {
    const row: Record<number, RoundCell> = {};
    count = Math.max(count, tokens.length);
    tokens.forEach((tok, i) => {
      const n = i + 1;
      if (tok === 'bye') {
        row[n] = { gameId: '', score: '1', opponent: '', ongoing: false, bye: true };
        return;
      }
      if (tok === 'absent' || tok === 'late' || !tok) return;
      const gameId = tok.slice(0, 8);
      const res = tok.length > 8 ? tok[8] : '';
      const g = byGame.get(gameId);
      const w = g?.players.white.user?.id;
      const b = g?.players.black.user?.id;
      const oppId = w === player ? b : w;
      const ongoing = res === '' || res === 'o';
      row[n] = {
        gameId,
        score: ongoing ? '•' : res === 'w' ? '1' : res === 'l' ? '0' : '½',
        opponent: oppId ? String(rankById.get(oppId) ?? '') : '',
        ongoing,
      };
    });
    cells.set(player, row);
  });
  return { cells, count };
}

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function LilaStandings({ tournamentId, kind = 'swiss', onLiveGame, liveGame, onLeaveGame }: Props) {
  const [rows, setRows] = useState<LilaRow[]>([]);
  const [games, setGames] = useState<LilaGame[]>([]);
  const [players, setPlayers] = useState<Record<string, PlayerInfo>>({});
  const [roundsCount, setRoundsCount] = useState(0);
  const [sheets, setSheets] = useState<Record<string, string[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profileId, setProfileId] = useState<number | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const gameParam = searchParams.get('game');
  const openedGame = gameParam && /^[A-Za-z0-9]{8}$/.test(gameParam) ? gameParam : null;
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const isMyLive = (id: string) => {
    const g = games.find(x => x.id === id);
    const me = user?.login?.toLowerCase();
    return !!g && !!me && ONGOING.includes(g.status) &&
      (g.players.white.user?.id?.toLowerCase() === me || g.players.black.user?.id?.toLowerCase() === me);
  };
  const setOpenedGame = (id: string | null) => {
    if (id && onLiveGame && isMyLive(id)) {
      onLiveGame(id);
      setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('game'); return n; }, { replace: true });
      return;
    }
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (id) next.set('game', id);
      else next.delete('game');
      return next;
    }, { replace: true });
  };
  const copyGameLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?game=${openedGame}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  useEffect(() => {
    if (openedGame && onLiveGame && isMyLive(openedGame)) setOpenedGame(openedGame);
  }, [openedGame, games, user]);
  useEffect(() => {
    if (!liveGame || !onLiveGame) return;
    const next = games.find(x => x.id !== liveGame && isMyLive(x.id));
    if (next) {
      const timer = setTimeout(() => onLiveGame(next.id), 1000);
      return () => clearTimeout(timer);
    }
    const cur = games.find(x => x.id === liveGame);
    if (!cur || ONGOING.includes(cur.status)) return;
    const timer = setTimeout(() => { if (onLeaveGame) onLeaveGame(); }, 6000);
    return () => clearTimeout(timer);
  }, [liveGame, games, user]);
  const [preview, setPreview] = useState<{ fen: string; x: number; y: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let first = true;
    let attempts = 0;
    setLoading(true);
    setError('');
    const base = `${LILA_ORIGIN}/api/${kind}/${tournamentId}`;

    const load = () => Promise.all([
      fetch(`${base}/results`, { headers: { Accept: 'application/x-ndjson' } }),
      fetch(`${base}/games?moves=false&lastFen=true`, { headers: { Accept: 'application/x-ndjson' } }),
      fetch(base, { headers: { Accept: 'application/json' } }),
    ])
      .then(async ([res, gm, info]) => {
        if (!res.ok) throw new Error(res.status === 404 ? 'Турнир не найден' : 'Не удалось загрузить таблицу');
        const parsed: LilaRow[] = parseNdjson(await res.text());
        if (cancelled) return;
        setError('');
        setRows(parsed);
        if (kind === 'swiss') fetch(`${PLAYERS_URL}?sheets=${encodeURIComponent(tournamentId)}`)
          .then(r => (r.ok ? r.json() : null))
          .then(d => { if (!cancelled && d && d.sheets && Object.keys(d.sheets).length) setSheets(d.sheets); })
          .catch(() => {});
        if (parsed.length) {
          const names = parsed.map(r => r.username).join(',');
          fetch(`${PLAYERS_URL}?usernames=${encodeURIComponent(names)}&tournament=${encodeURIComponent(tournamentId)}`)
            .then(r => (r.ok ? r.json() : { players: {} }))
            .then(d => { if (!cancelled && d.players) setPlayers(d.players); })
            .catch(() => {});
        }
        if (gm.ok) {
          const parsedGames = safeParse(await gm.text());
          if (parsedGames.length || !parsed.length) setGames(parsedGames);
        }
        if (info.ok) {
          const data = await info.json();
          setRoundsCount(data.nbRounds || 0);
        }
      })
      .then(() => { attempts = 0; first = false; if (!cancelled) setLoading(false); })
      .catch(e => {
        if (cancelled) return;
        attempts += 1;
        if (first && attempts < 4) {
          retryTimer = setTimeout(load, 2000);
          return;
        }
        if (first) setError(e.message || 'Не удалось загрузить таблицу');
        first = false;
        setLoading(false);
      });

    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, 7000);

    return () => {
      cancelled = true;
      clearInterval(timer);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [tournamentId, kind]);

  const fallback = buildRounds(games, rows, roundsCount);
  const fromSheets = sheets ? buildFromSheets(sheets, games, rows) : null;
  const cells = fromSheets ? fromSheets.cells : fallback.cells;
  const count = fromSheets ? Math.max(fromSheets.count, roundsCount) : fallback.count;
  const fenById = new Map(games.filter(g => g.lastFen).map(g => [g.id, g.lastFen as string]));
  const showPreview = (e: React.MouseEvent<HTMLElement>, gameId: string) => {
    const fen = fenById.get(gameId);
    if (!fen) return;
    const r = e.currentTarget.getBoundingClientRect();
    const size = 180;
    const x = Math.min(Math.max(8, r.left + r.width / 2 - size / 2), window.innerWidth - size - 8);
    const below = r.bottom + size + 16 < window.innerHeight;
    setPreview({ fen, x, y: below ? r.bottom + 6 : r.top - size - 14 });
  };
  const roundNumbers = Array.from({ length: count }, (_, i) => i + 1);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-6">
        <Icon name="Loader2" size={20} className="animate-spin" /> Загрузка...
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-500 py-4">{error}</p>;
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 overflow-x-auto">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Турнирная таблица</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-400 text-xs uppercase">
            <th className="pb-2 pr-2 font-medium">Место</th>
            <th className="pb-2 pr-2 font-medium">Участник</th>
            <th className="pb-2 pr-2 font-medium text-right">Возраст</th>
            <th className="pb-2 pr-2 font-medium text-right">Рейтинг</th>
            {roundNumbers.map(n => (
              <th key={n} className="pb-2 pr-2 font-medium text-center">Т{n}</th>
            ))}
            <th className="pb-2 pr-2 font-medium text-right">Очки</th>
            <th className="pb-2 pr-2 font-medium text-right">Коэф.</th>
            <th className="pb-2 font-medium text-right">Перфоманс</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(p => (
            <tr key={p.username} className="border-t border-gray-50">
              <td className="py-2 pr-2 text-gray-400">
                {MEDALS[p.rank] ? (
                  <span className="inline-flex items-center gap-1">
                    <span>{MEDALS[p.rank]}</span>
                    <span className="font-semibold text-gray-600">{p.rank}</span>
                  </span>
                ) : (
                  p.rank
                )}
              </td>
              <td className="py-2 pr-2 font-medium text-gray-800">
                {(() => {
                  const info = players[p.username.toLowerCase()];
                  const name = info?.fio ? shortFio(info.fio) : p.username;
                  const inner = (
                    <>
                      <PlayerAvatar fio={info?.fio || p.username} avatarUrl={info?.avatar_url} size={22} />
                      <span className="truncate">{name}</span>
                    </>
                  );
                  return info ? (
                    <button
                      type="button"
                      onClick={() => setProfileId(info.user_id)}
                      className="inline-flex items-center gap-1.5 hover:underline hover:text-secondary text-left"
                    >
                      {inner}
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">{inner}</span>
                  );
                })()}
                {p.absent && <span className="ml-1.5 text-xs text-gray-400 font-normal">выбыл(а)</span>}
              </td>
              <td className="py-2 pr-2 text-right text-gray-500">{players[p.username.toLowerCase()]?.age ?? '—'}</td>
              <td className="py-2 pr-2 text-right text-gray-500">
                {p.rating}
                {(() => {
                  const d = players[p.username.toLowerCase()]?.rating_delta;
                  if (d === null || d === undefined) return null;
                  return (
                    <span className={`ml-1.5 text-xs font-semibold ${d > 0 ? 'text-emerald-600' : d < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                      {d > 0 ? '+' : ''}{Math.round(d)}
                    </span>
                  );
                })()}
              </td>
              {roundNumbers.map(n => {
                const c = cells.get(p.username.toLowerCase())?.[n];
                return (
                  <td key={n} className="py-2 pr-2 text-center text-gray-600">
                    {c ? (
                      c.bye ? (
                        <span className={`font-semibold ${scoreColor(c)}`} title="Бай">{c.score}</span>
                      ) : (
                        <a
                          href={`${LILA_ORIGIN}/${c.gameId}`}
                          onClick={e => {
                            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                            e.preventDefault();
                            setPreview(null);
                            setOpenedGame(c.gameId);
                          }}
                          title={c.opponent ? `Соперник: место ${c.opponent}` : undefined}
                          onMouseEnter={e => showPreview(e, c.gameId)}
                          onMouseLeave={() => setPreview(null)}
                          className="inline-flex items-baseline gap-0.5 hover:underline"
                        >
                          <span className={`font-semibold ${scoreColor(c)}`}>{c.score}</span>
                          {c.opponent && <span className="text-[10px] text-gray-400">({c.opponent})</span>}
                        </a>
                      )
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                );
              })}
              <td className="py-2 pr-2 text-right font-semibold text-primary">{p.points}</td>
              <td className="py-2 pr-2 text-right text-gray-500">{p.tieBreak}</td>
              <td className="py-2 text-right text-gray-500">{p.performance ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {preview && (
        <div
          className="fixed z-50 pointer-events-none bg-white rounded-xl border border-gray-100 shadow-xl p-2"
          style={{ left: preview.x, top: preview.y }}
        >
          <MiniChessBoard fen={preview.fen} size={180} />
        </div>
      )}
      <Dialog open={!!openedGame} onOpenChange={open => { if (!open) setOpenedGame(null); }}>
        <DialogContent className="max-w-3xl w-[96vw] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg pr-6">
              {(() => {
                const g = games.find(x => x.id === openedGame);
                if (!g) return 'Партия';
                const nameOf = (id?: string) => {
                  if (!id) return '—';
                  const info = players[id.toLowerCase()];
                  return info?.fio ? shortFio(info.fio) : id;
                };
                const res = ONGOING.includes(g.status) ? 'идёт' : g.winner === 'white' ? '1 : 0' : g.winner === 'black' ? '0 : 1' : '½ : ½';
                return (
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 rounded-full bg-white border border-gray-400 inline-block" />
                      {nameOf(g.players.white.user?.id)}
                    </span>
                    <span className="text-gray-400 font-normal">{res}</span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 rounded-full bg-gray-900 border border-gray-900 inline-block" />
                      {nameOf(g.players.black.user?.id)}
                    </span>
                  </span>
                );
              })()}
            </DialogTitle>
          </DialogHeader>
          {openedGame && (
            <button
              type="button"
              onClick={copyGameLink}
              className="self-start inline-flex items-center gap-1.5 text-sm font-medium text-secondary hover:underline"
            >
              <Icon name={copied ? 'Check' : 'Link'} size={14} />
              {copied ? 'Ссылка скопирована' : 'Копировать ссылку на партию'}
            </button>
          )}
          {openedGame && (
            <iframe
              key={openedGame}
              title="Партия в Lila"
              src={`${LILA_ORIGIN}/embed/game/${openedGame}?theme=auto&bg=auto`}
              className="w-full h-[70vh] min-h-[420px] rounded-lg border border-gray-100 bg-white"
              allowFullScreen
            />
          )}
        </DialogContent>
      </Dialog>
      <PlayerProfileModal userId={profileId} onClose={() => setProfileId(null)} />
    </div>
  );
}