import { useState, useEffect, useCallback } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { Header, Footer } from '@/components/Layout';
import Seo from '@/components/Seo';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import func2url from '../../backend/func2url.json';

const HALL_URL = func2url['tournament-hall'];

interface Game {
  id: number;
  white_player_id: number | null;
  white_fio: string | null;
  black_player_id: number | null;
  black_fio: string | null;
  is_bye: boolean;
  status: string;
  result: string | null;
}

interface Round {
  round_number: number;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  games: Game[];
}

interface Player {
  id: number;
  fio: string;
  rating: number;
  points: number;
  buchholz: number;
}

interface TournamentInfo {
  id: number;
  title: string;
  time_control: string;
  rounds_count: number;
  hall_status: string;
  round_break_seconds: number;
}

interface HallData {
  tournament: TournamentInfo;
  players: Player[];
  rounds: Round[];
  my_player_id: number | null;
  my_game_id: number | null;
}

const RESULT_LABELS: Record<string, string> = { '1-0': '1–0', '0-1': '0–1', '1/2-1/2': '½–½' };

export default function Hall() {
  const { tournamentId } = useParams();
  const { user, token, loading } = useAuth();
  const [data, setData] = useState<HallData | null>(null);
  const [fetchError, setFetchError] = useState('');
  const [activeRound, setActiveRound] = useState<number | null>(null);

  const fetchHall = useCallback(async () => {
    if (!tournamentId) return;
    try {
      const res = await fetch(`${HALL_URL}?tournament_id=${tournamentId}`, {
        headers: token ? { 'X-Auth-Token': token } : {},
      });
      const json = await res.json();
      if (!res.ok) { setFetchError(json.error || 'Не удалось загрузить турнирный зал'); return; }
      setData(json);
      setFetchError('');
      setActiveRound(prev => prev ?? (json.rounds?.length ? json.rounds[json.rounds.length - 1].round_number : null));
    } catch {
      setFetchError('Не удалось загрузить турнирный зал');
    }
  }, [tournamentId, token]);

  useEffect(() => {
    fetchHall();
    const interval = setInterval(fetchHall, 4000);
    return () => clearInterval(interval);
  }, [fetchHall]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Icon name="Loader2" size={32} className="animate-spin text-secondary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (fetchError && !data) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Seo title="Турнирный зал" description="Турнирный зал" path={`/hall/${tournamentId}`} noindex />
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
            <Icon name="Swords" size={40} className="text-secondary mx-auto mb-4" />
            <h1 className="font-heading font-bold text-2xl text-primary mb-2">Турнирный зал скоро откроется</h1>
            <p className="text-gray-500 text-sm mb-6">{fetchError}</p>
            <Link to="/cabinet">
              <Button variant="outline"><Icon name="ArrowLeft" size={16} className="mr-2" /> Вернуться в кабинет</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Icon name="Loader2" size={32} className="animate-spin text-secondary" />
      </div>
    );
  }

  const { tournament, players, rounds, my_game_id } = data;
  const totalGames = rounds.reduce((acc, r) => acc + r.games.filter(g => !g.is_bye).length, 0);
  const finishedGames = rounds.reduce((acc, r) => acc + r.games.filter(g => !g.is_bye && g.status === 'finished').length, 0);
  const whiteWins = rounds.reduce((acc, r) => acc + r.games.filter(g => g.result === '1-0').length, 0);
  const blackWins = rounds.reduce((acc, r) => acc + r.games.filter(g => g.result === '0-1').length, 0);
  const draws = rounds.reduce((acc, r) => acc + r.games.filter(g => g.result === '1/2-1/2').length, 0);
  const byes = rounds.reduce((acc, r) => acc + r.games.filter(g => g.is_bye).length, 0);
  const avgRating = players.length ? Math.round(players.reduce((a, p) => a + p.rating, 0) / players.length) : 0;
  const pct = (n: number) => totalGames ? Math.round((n / totalGames) * 100) : 0;

  const currentRound = rounds.find(r => r.round_number === activeRound) || rounds[rounds.length - 1];
  const isFinished = tournament.hall_status === 'finished';
  const isActive = tournament.hall_status === 'active';

  return (
    <div className="min-h-screen bg-muted text-foreground flex flex-col">
      <Seo title={`${tournament.title} — турнирный зал`} description="Турнирный зал" path={`/hall/${tournamentId}`} noindex />
      <Header />

      <main className="flex-1 py-6 px-4">
        <div className="container max-w-7xl mx-auto">
          {my_game_id && isActive && (
            <div className="mb-4 bg-primary text-primary-foreground rounded-2xl px-5 py-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 font-semibold">
                <Icon name="Swords" size={18} className="text-secondary" /> У вас идёт партия!
              </div>
              <Link to={`/game/${my_game_id}`}>
                <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                  Перейти к партии <Icon name="ArrowRight" size={16} className="ml-2" />
                </Button>
              </Link>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_300px] gap-5">
            {/* Левая колонка: карточка турнира */}
            <div className="flex flex-col gap-5">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Icon name="Rabbit" size={22} />
                </div>
                <p className="text-sm text-gray-700 font-medium">
                  {tournament.time_control || '—'} · Рапид
                </p>
                <p className="text-sm text-gray-500 mb-3">
                  {rounds.length}/{tournament.rounds_count} туров · Швейцарский
                </p>
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
                  <Icon name="Clock" size={12} /> {tournament.round_break_seconds} сек между турами
                </div>
                <p className="text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
                  Турнир проходит по швейцарской системе. Пары формируются автоматически на основе набранных очков.
                </p>
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                  <Icon name="Users" size={15} className="text-secondary" />
                  <span className="text-sm text-primary font-medium">{players.length} участников</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Раунды</p>
                <div className="flex flex-col gap-1">
                  {rounds.map(r => (
                    <button key={r.round_number} onClick={() => setActiveRound(r.round_number)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${activeRound === r.round_number ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-gray-700'}`}>
                      <span>Тур {r.round_number}</span>
                      <span className={`text-xs ${activeRound === r.round_number ? 'text-secondary' : 'text-gray-400'}`}>
                        {r.status === 'active' ? 'Идёт' : r.status === 'completed' ? 'Завершён' : 'Ожидание'}
                      </span>
                    </button>
                  ))}
                  {rounds.length === 0 && <p className="text-sm text-gray-400 py-2">Туры ещё не начались</p>}
                </div>
              </div>
            </div>

            {/* Центр: заголовок + пары тура */}
            <div className="flex flex-col gap-5">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
                <Icon name="Trophy" size={28} className="text-secondary mx-auto mb-2" />
                <h1 className="font-heading font-bold text-2xl md:text-3xl text-primary">{tournament.title}</h1>
                {isFinished && <p className="text-sm text-gray-400 mt-2">Турнир завершён</p>}
                {isActive && <p className="text-sm text-emerald-600 font-medium mt-2 flex items-center justify-center gap-1"><Icon name="Radio" size={13} className="animate-pulse" /> Турнир идёт</p>}
                {tournament.hall_status === 'not_started' && <p className="text-sm text-gray-400 mt-2">Турнир ещё не начался</p>}
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-heading font-bold text-lg text-primary">Тур {currentRound?.round_number ?? '—'}</h2>
                  {currentRound && (
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${currentRound.status === 'active' ? 'bg-emerald-100 text-emerald-700' : currentRound.status === 'completed' ? 'bg-gray-100 text-gray-500' : 'bg-orange-100 text-orange-700'}`}>
                      {currentRound.status === 'active' ? 'Идёт' : currentRound.status === 'completed' ? 'Завершён' : 'Ожидание'}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {currentRound?.games.map(g => (
                    <div key={g.id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100 hover:bg-muted/50 transition-colors">
                      {g.is_bye ? (
                        <span className="text-sm text-gray-600 flex items-center gap-2">
                          <Icon name="Moon" size={14} className="text-gray-400" /> {g.white_fio} — технический бай (+1)
                        </span>
                      ) : (
                        <>
                          <div className="flex-1 flex items-center gap-2 min-w-0">
                            <span className="w-3 h-3 rounded-sm bg-white border border-gray-300 shrink-0" />
                            <span className="truncate text-sm font-medium text-gray-800">{g.white_fio}</span>
                          </div>
                          <div className="px-3 shrink-0">
                            {g.status === 'finished' ? (
                              <span className="text-sm font-bold text-primary">{RESULT_LABELS[g.result || ''] || g.result}</span>
                            ) : (
                              <Link to={`/game/${g.id}`} className="text-xs text-secondary hover:underline font-medium">Смотреть</Link>
                            )}
                          </div>
                          <div className="flex-1 flex items-center gap-2 justify-end min-w-0">
                            <span className="truncate text-sm font-medium text-gray-800 text-right">{g.black_fio}</span>
                            <span className="w-3 h-3 rounded-sm bg-gray-800 shrink-0" />
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {!currentRound && <p className="text-sm text-gray-400 py-4 text-center">Пары появятся, когда организатор начнёт турнир</p>}
                </div>
              </div>

              {/* Таблица участников */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 overflow-x-auto">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Турнирная таблица</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 text-xs uppercase">
                      <th className="pb-2 pr-2 font-medium">#</th>
                      <th className="pb-2 pr-2 font-medium">Участник</th>
                      <th className="pb-2 pr-2 font-medium text-right">Рейтинг</th>
                      <th className="pb-2 pr-2 font-medium text-right">Очки</th>
                      <th className="pb-2 font-medium text-right">Бухгольц</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((p, i) => (
                      <tr key={p.id} className="border-t border-gray-50">
                        <td className="py-2 pr-2 text-gray-400">{i + 1}</td>
                        <td className="py-2 pr-2 font-medium text-gray-800">{p.fio}</td>
                        <td className="py-2 pr-2 text-right text-gray-500">{p.rating}</td>
                        <td className="py-2 pr-2 text-right font-bold text-primary">{p.points}</td>
                        <td className="py-2 text-right text-gray-500">{p.buchholz}</td>
                      </tr>
                    ))}
                    {players.length === 0 && (
                      <tr><td colSpan={5} className="py-6 text-center text-gray-400">Участники ещё не зарегистрированы</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Правая колонка: статистика */}
            <div className="flex flex-col gap-5">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h3 className="font-heading font-bold text-primary mb-4">
                  {isFinished ? 'Турнир завершён' : isActive ? 'Турнир идёт' : 'Турнир не начался'}
                </h3>
                <dl className="flex flex-col gap-2.5 text-sm">
                  <div className="flex justify-between"><dt className="text-gray-500">Средний рейтинг участников</dt><dd className="font-semibold text-gray-800">{avgRating}</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-500">Сыграно партий</dt><dd className="font-semibold text-gray-800">{finishedGames}</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-500">Побед белыми</dt><dd className="font-semibold text-gray-800">{pct(whiteWins)}%</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-500">Побед чёрными</dt><dd className="font-semibold text-gray-800">{pct(blackWins)}%</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-500">Показатель ничьих</dt><dd className="font-semibold text-gray-800">{pct(draws)}%</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-500">Технических баев</dt><dd className="font-semibold text-gray-800">{byes}</dd></div>
                </dl>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Быстрые действия</p>
                <div className="flex flex-col gap-2">
                  <Link to="/cabinet" className="flex items-center gap-2 text-sm text-gray-600 hover:text-secondary transition-colors">
                    <Icon name="ArrowLeft" size={15} /> Вернуться в кабинет
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}