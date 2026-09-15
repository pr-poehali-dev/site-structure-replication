import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateTime } from './utils';
import func2url from '../../../backend/func2url.json';

const RATING_HISTORY_URL = func2url['rating-history'];

interface RatingHistoryItem {
  id: number;
  tournament_id: number;
  tournament_title: string;
  rating_type: 'blitz' | 'rapid';
  rating_before: number;
  rating_after: number;
  delta: number;
  points: number;
  expected_points: number;
  games_count: number;
  created_at: string;
}

const RATING_TYPE_LABELS: Record<string, string> = { blitz: 'Блиц', rapid: 'Рапид' };

export default function RatingHistorySection() {
  const { token } = useAuth();
  const [history, setHistory] = useState<RatingHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(RATING_HISTORY_URL, { headers: { 'X-Auth-Token': token } })
      .then(r => r.json())
      .then(data => setHistory(data.history || []))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-heading font-bold text-lg text-primary mb-1 flex items-center gap-2">
          <Icon name="TrendingUp" size={20} className="text-secondary" /> История рейтинга
        </h3>
        <p className="text-sm text-gray-400">
          Рейтинг МШ пересчитывается по итогам каждого завершённого турнира: сравнивается фактический результат с ожидаемым по силе соперников.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-gray-400 py-10 text-center"><Icon name="Loader2" size={20} className="animate-spin inline mr-2" />Загрузка...</div>
        ) : history.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Icon name="TrendingUp" size={32} className="mx-auto mb-2 opacity-30" />
            <p>Пока нет изменений рейтинга — сыграйте турнир до конца</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-gray-50">
            {history.map(h => {
              const positive = h.delta > 0;
              const negative = h.delta < 0;
              return (
                <div key={h.id} className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-medium text-gray-800">{h.tournament_title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDateTime(h.created_at)} · {RATING_TYPE_LABELS[h.rating_type] || h.rating_type} · {h.points} из {h.games_count} партий
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm text-gray-400">{h.rating_before} → <span className="font-semibold text-primary">{h.rating_after}</span></span>
                    <span className={`flex items-center gap-1 text-sm font-bold px-2.5 py-1 rounded-full ${
                      positive ? 'bg-green-100 text-green-700' : negative ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <Icon name={positive ? 'ArrowUp' : negative ? 'ArrowDown' : 'Minus'} size={13} />
                      {positive ? '+' : ''}{h.delta}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
