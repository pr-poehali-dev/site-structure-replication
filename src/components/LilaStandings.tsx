import { useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';

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
  winner?: 'white' | 'black';
  players: { white: { user?: { id: string } }; black: { user?: { id: string } } };
}

interface RoundCell {
  gameId: string;
  score: string;
  opponent: string;
  ongoing: boolean;
}

interface Props {
  tournamentId: string;
  kind?: 'swiss' | 'tournament';
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

function buildRounds(games: LilaGame[], rows: LilaRow[], roundsCount: number) {
  const rankById = new Map(rows.map(r => [r.username.toLowerCase(), r.rank]));
  const lastRound = new Map<string, number>();
  const cells = new Map<string, Record<number, RoundCell>>();
  const sorted = [...games].sort((a, b) => a.createdAt - b.createdAt);
  let maxRound = 0;

  const put = (player: string, round: number, cell: RoundCell) => {
    const row = cells.get(player) || {};
    row[round] = cell;
    cells.set(player, row);
  };

  sorted.forEach(g => {
    const w = g.players.white.user?.id;
    const b = g.players.black.user?.id;
    if (!w || !b) return;
    const round = Math.max(lastRound.get(w) || 0, lastRound.get(b) || 0) + 1;
    lastRound.set(w, round);
    lastRound.set(b, round);
    maxRound = Math.max(maxRound, round);
    const ongoing = ONGOING.includes(g.status);
    const wScore = ongoing ? '•' : g.winner === 'white' ? '1' : g.winner === 'black' ? '0' : '½';
    const bScore = ongoing ? '•' : g.winner === 'black' ? '1' : g.winner === 'white' ? '0' : '½';
    put(w, round, { gameId: g.id, score: wScore, opponent: String(rankById.get(b) ?? ''), ongoing });
    put(b, round, { gameId: g.id, score: bScore, opponent: String(rankById.get(w) ?? ''), ongoing });
  });

  return { cells, count: Math.max(roundsCount, maxRound) };
}

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function LilaStandings({ tournamentId, kind = 'swiss' }: Props) {
  const [rows, setRows] = useState<LilaRow[]>([]);
  const [games, setGames] = useState<LilaGame[]>([]);
  const [roundsCount, setRoundsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    const base = `${LILA_ORIGIN}/api/${kind}/${tournamentId}`;
    Promise.all([
      fetch(`${base}/results`, { headers: { Accept: 'application/x-ndjson' } }),
      fetch(`${base}/games?moves=false`, { headers: { Accept: 'application/x-ndjson' } }),
      fetch(base, { headers: { Accept: 'application/json' } }),
    ])
      .then(async ([res, gm, info]) => {
        if (!res.ok) throw new Error('Турнир не найден');
        setRows(parseNdjson(await res.text()));
        setGames(gm.ok ? safeParse(await gm.text()) : []);
        if (info.ok) {
          const data = await info.json();
          setRoundsCount(data.nbRounds || 0);
        }
      })
      .catch(e => setError(e.message || 'Не удалось загрузить таблицу'))
      .finally(() => setLoading(false));
  }, [tournamentId, kind]);

  const { cells, count } = buildRounds(games, rows, roundsCount);
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
                {p.username}
                {p.absent && <span className="ml-1.5 text-xs text-gray-400 font-normal">выбыл(а)</span>}
              </td>
              <td className="py-2 pr-2 text-right text-gray-500">{p.rating}</td>
              {roundNumbers.map(n => {
                const c = cells.get(p.username.toLowerCase())?.[n];
                return (
                  <td key={n} className="py-2 pr-2 text-center text-gray-600">
                    {c ? (
                      <a
                        href={`${LILA_ORIGIN}/${c.gameId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={c.opponent ? `Соперник: место ${c.opponent}` : undefined}
                        className="inline-flex items-baseline gap-0.5 hover:text-secondary hover:underline"
                      >
                        <span className="font-semibold">{c.score}</span>
                        {c.opponent && <span className="text-[10px] text-gray-400">({c.opponent})</span>}
                      </a>
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
    </div>
  );
}
