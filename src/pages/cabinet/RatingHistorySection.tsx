import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import Icon from '@/components/ui/icon';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
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

interface ChartPoint {
  date: string;
  label: string;
  blitz?: number;
  rapid?: number;
}

const RATING_TYPE_LABELS: Record<string, string> = { blitz: 'Блиц', rapid: 'Рапид' };

const chartConfig: ChartConfig = {
  blitz: { label: 'Блиц', color: 'hsl(44 90% 52%)' },
  rapid: { label: 'Рапид', color: 'hsl(217 91% 60%)' },
};

function shortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export default function RatingHistorySection() {
  const { token, user } = useAuth();
  const [history, setHistory] = useState<RatingHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(RATING_HISTORY_URL, { headers: { 'X-Auth-Token': token } })
      .then(r => r.json())
      .then(data => setHistory(data.history || []))
      .finally(() => setLoading(false));
  }, [token]);

  const chartData = useMemo<ChartPoint[]>(() => {
    const chronological = [...history].reverse();
    const points: ChartPoint[] = [];
    let lastBlitz: number | undefined;
    let lastRapid: number | undefined;
    for (const h of chronological) {
      if (h.rating_type === 'blitz') lastBlitz = h.rating_after;
      else lastRapid = h.rating_after;
      points.push({
        date: h.created_at,
        label: shortDate(h.created_at),
        blitz: lastBlitz,
        rapid: lastRapid,
      });
    }
    return points;
  }, [history]);

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

      {!loading && chartData.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex flex-col md:flex-row gap-6 items-stretch">
            <div className="flex-1 min-w-0">
              <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
                <LineChart data={chartData} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} width={44} domain={['dataMin - 20', 'dataMax + 20']} />
                  <ChartTooltip content={<ChartTooltipContent labelKey="label" />} />
                  <Line type="monotone" dataKey="blitz" stroke="var(--color-blitz)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls name="Блиц" />
                  <Line type="monotone" dataKey="rapid" stroke="var(--color-rapid)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls name="Рапид" />
                </LineChart>
              </ChartContainer>
            </div>

            <div className="flex md:flex-col gap-3 shrink-0 md:w-36">
              <div className="flex-1 bg-secondary/10 rounded-xl px-4 py-3 text-center">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Блиц сейчас</p>
                <p className="font-heading font-bold text-2xl text-primary flex items-center justify-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: 'hsl(44 90% 52%)' }} />
                  {user?.rating_blitz ?? '—'}
                </p>
              </div>
              <div className="flex-1 bg-blue-500/10 rounded-xl px-4 py-3 text-center">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Рапид сейчас</p>
                <p className="font-heading font-bold text-2xl text-primary flex items-center justify-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: 'hsl(217 91% 60%)' }} />
                  {user?.rating_rapid ?? '—'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

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
                    <Link to={`/hall/${h.tournament_id}`} className="font-medium text-gray-800 hover:text-secondary hover:underline">
                      {h.tournament_title}
                    </Link>
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
                      {positive ? '+' : ''}{Math.round(h.delta)}
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