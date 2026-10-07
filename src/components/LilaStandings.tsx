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

interface Props {
  tournamentId: string;
  kind?: 'swiss' | 'tournament';
}

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function LilaStandings({ tournamentId, kind = 'swiss' }: Props) {
  const [rows, setRows] = useState<LilaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`${LILA_ORIGIN}/api/${kind}/${tournamentId}/results`)
      .then(async r => {
        if (!r.ok) throw new Error('Турнир не найден');
        const text = await r.text();
        return text
          .split('\n')
          .filter(l => l.trim())
          .map(l => JSON.parse(l) as LilaRow);
      })
      .then(setRows)
      .catch(e => setError(e.message || 'Не удалось загрузить таблицу'))
      .finally(() => setLoading(false));
  }, [tournamentId, kind]);

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
