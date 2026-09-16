import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import MiniChessBoard from '@/components/MiniChessBoard';
import { useAuth } from '@/contexts/AuthContext';
import { shortFio } from '@/lib/fio';
import { formatDateTime } from './utils';
import func2url from '../../../backend/func2url.json';

const GAME_HISTORY_URL = func2url['game-history'];

interface GameHistoryItem {
  id: number;
  tournament_id: number;
  tournament_title: string;
  round_number: number;
  rating_type: 'blitz' | 'rapid';
  my_color: 'white' | 'black';
  opponent_fio: string | null;
  result: string | null;
  result_reason: string | null;
  outcome: 'win' | 'loss' | 'draw';
  fen: string;
  moves_count: number;
  finished_at: string | null;
  started_at: string | null;
}

const RATING_TYPE_LABELS: Record<string, string> = { blitz: 'Блиц', rapid: 'Рапид' };

const REASON_LABELS: Record<string, string> = {
  checkmate: 'Мат',
  stalemate: 'Пат',
  draw_agreed: 'Ничья по соглашению',
  resignation: 'Сдача',
  timeout: 'Поражение по времени',
  insufficient_material: 'Недостаточно материала',
  first_move_timeout: 'Не сделан первый ход',
};

function resultLabel(g: GameHistoryItem): string {
  const reason = g.result_reason ? REASON_LABELS[g.result_reason] || g.result_reason : '';
  if (g.result === '1/2-1/2') return reason || 'Ничья';
  const winnerColor = g.result === '1-0' ? 'Белые' : 'Чёрные';
  return reason ? `${reason} · Победа: ${winnerColor.toLowerCase()}` : `Победа: ${winnerColor.toLowerCase()}`;
}

export default function GamesHistorySection() {
  const { token } = useAuth();
  const [games, setGames] = useState<GameHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(GAME_HISTORY_URL, { headers: { 'X-Auth-Token': token } })
      .then(r => r.json())
      .then(data => setGames(data.games || []))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-heading font-bold text-lg text-primary mb-1 flex items-center gap-2">
          <Icon name="History" size={20} className="text-secondary" /> История партий
        </h3>
        <p className="text-sm text-gray-400">
          Все ваши завершённые партии на турнирах. Нажмите на партию, чтобы пересмотреть ходы.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-gray-400 py-10 text-center"><Icon name="Loader2" size={20} className="animate-spin inline mr-2" />Загрузка...</div>
        ) : games.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Icon name="History" size={32} className="mx-auto mb-2 opacity-30" />
            <p>Пока нет сыгранных партий — сыграйте свой первый турнир</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-gray-50">
            {games.map(g => {
              const badgeClass =
                g.outcome === 'win' ? 'bg-green-100 text-green-700' :
                g.outcome === 'loss' ? 'bg-red-100 text-red-600' :
                'bg-gray-100 text-gray-500';
              const badgeLabel = g.outcome === 'win' ? 'Победа' : g.outcome === 'loss' ? 'Поражение' : 'Ничья';
              const badgeIcon = g.outcome === 'win' ? 'Trophy' : g.outcome === 'loss' ? 'X' : 'Minus';

              return (
                <Link
                  key={g.id}
                  to={`/game/${g.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-muted/40 transition-colors"
                >
                  <MiniChessBoard fen={g.fen} size={96} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${badgeClass}`}>
                        <Icon name={badgeIcon} size={11} /> {badgeLabel}
                      </span>
                      <span className="font-medium text-gray-800 truncate">
                        {g.my_color === 'white' ? 'Белыми' : 'Чёрными'} против {shortFio(g.opponent_fio) || 'соперника'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 truncate">
                      {g.tournament_title} · Тур {g.round_number} · {RATING_TYPE_LABELS[g.rating_type] || g.rating_type}
                      {g.finished_at ? ` · ${formatDateTime(g.finished_at)}` : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{resultLabel(g)} · {g.moves_count} {g.moves_count === 1 ? 'ход' : 'ходов'}</p>
                  </div>

                  <Icon name="ChevronRight" size={18} className="text-gray-300 shrink-0" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}