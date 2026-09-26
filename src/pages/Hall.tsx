import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Navigate, Link } from 'react-router-dom';
import { Header, Footer } from '@/components/Layout';
import Seo from '@/components/Seo';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { usePusherChannel, usePusherConnectionStatus, ConnectionStatus } from '@/hooks/usePusherChannel';
import { shortFio } from '@/lib/fio';
import PlayerAvatar from '@/components/PlayerAvatar';
import MiniChessBoard from '@/components/MiniChessBoard';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import func2url from '../../backend/func2url.json';

const HALL_URL = func2url['tournament-hall'];

interface Game {
  id: number;
  white_player_id: number | null;
  white_fio: string | null;
  white_user_id: number | null;
  white_avatar_url: string | null;
  black_player_id: number | null;
  black_fio: string | null;
  black_user_id: number | null;
  black_avatar_url: string | null;
  is_bye: boolean;
  status: string;
  result: string | null;
  fen: string | null;
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
  user_id: number | null;
  avatar_url: string | null;
  rating: number;
  points: number;
  buchholz: number;
  wins: number;
  place: number | null;
  joined_late: boolean;
  rating_delta: number | null;
  online?: boolean;
}

interface TournamentInfo {
  id: number;
  title: string;
  time_control: string;
  rounds_count: number;
  hall_status: string;
  round_break_seconds: number;
  rating_type?: 'blitz' | 'rapid';
  admin_message?: string | null;
}

const RATING_TYPE_LABELS: Record<string, string> = { blitz: 'Блиц', rapid: 'Рапид' };

interface HallData {
  tournament: TournamentInfo;
  players: Player[];
  rounds: Round[];
  my_player_id: number | null;
  my_game_id: number | null;
  next_round_at: string | null;
}

function formatCountdown(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const RESULT_LABELS: Record<string, string> = { '1-0': '1–0', '0-1': '0–1', '1/2-1/2': '½–½' };

function findPlayerRoundGame(playerId: number, round: Round): Game | null {
  return round.games.find(g => g.white_player_id === playerId || g.black_player_id === playerId) || null;
}

function playerRoundScore(playerId: number, game: Game | null): string | null {
  if (!game) return null;
  if (game.is_bye) return '1';
  if (game.status !== 'finished' || !game.result) return null;
  const isWhite = game.white_player_id === playerId;
  if (game.result === '1/2-1/2') return '½';
  if (game.result === '1-0') return isWhite ? '1' : '0';
  if (game.result === '0-1') return isWhite ? '0' : '1';
  return null;
}

/** Цвет очка за тур: победа — зелёный, поражение — красный, ничья/бай — чёрный. */
function scoreColorClass(score: string | null): string {
  if (score === '1') return 'text-emerald-600';
  if (score === '0') return 'text-red-500';
  return 'text-gray-800';
}

function GameCellContent({ score }: { score: string | null }) {
  if (!score) return <span className="text-gray-300">—</span>;
  return <span className={`font-semibold ${scoreColorClass(score)}`}>{score}</span>;
}

/** ФИО игрока (опционально с аватаром) — ссылка на его публичный профиль, если известен
 * user_id (аккаунт на платформе), иначе обычный текст (участник без аккаунта, добавлен админом вручную). */
function PlayerLink({ userId, fio, avatarUrl, avatarSize, className }: { userId: number | null | undefined; fio: string | null; avatarUrl?: string | null; avatarSize?: number; className?: string }) {
  const content = (
    <>
      {avatarSize && <PlayerAvatar fio={fio} avatarUrl={avatarUrl} size={avatarSize} />}
      <span className="truncate">{shortFio(fio)}</span>
    </>
  );
  const wrapperClass = avatarSize ? `inline-flex items-center gap-1.5 ${className || ''}` : className;
  if (!userId) return <span className={wrapperClass}>{content}</span>;
  return (
    <Link to={`/player/${userId}`} className={`hover:underline hover:text-secondary ${wrapperClass || ''}`} onClick={e => e.stopPropagation()}>
      {content}
    </Link>
  );
}

function RoundResultCell({ playerId, game, score, gameHref }: { playerId: number; game: Game; score: string | null; gameHref: string }) {
  const isWhite = game.white_player_id === playerId;
  const myScore = score === '1' ? '1' : score === '0' ? '0' : score === '½' ? '½' : '';
  const oppScore = myScore === '1' ? '0' : myScore === '0' ? '1' : myScore === '½' ? '½' : '';
  const whiteScore = isWhite ? myScore : oppScore;
  const blackScore = isWhite ? oppScore : myScore;
  if (!game.fen) {
    return (
      <Link to={gameHref} className="hover:underline hover:text-secondary font-medium">
        <GameCellContent score={score} />
      </Link>
    );
  }
  return (
    <HoverCard openDelay={150} closeDelay={0}>
      <HoverCardTrigger asChild>
        <Link to={gameHref} className="hover:underline hover:text-secondary font-medium">
          <GameCellContent score={score} />
        </Link>
      </HoverCardTrigger>
      <HoverCardContent className="w-auto p-3" align="center">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3 text-xs font-medium text-gray-700">
            <PlayerLink userId={game.black_user_id} fio={game.black_fio} className="truncate max-w-[110px]" />
            <span className="text-gray-400">{blackScore}</span>
          </div>
          <MiniChessBoard fen={game.fen} size={160} />
          <div className="flex items-center justify-between gap-3 text-xs font-medium text-gray-700">
            <PlayerLink userId={game.white_user_id} fio={game.white_fio} className="truncate max-w-[110px]" />
            <span className="text-gray-400">{whiteScore}</span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export default function Hall() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Ссылка "Зал" из админки открывает страницу в режиме наблюдателя (?observer=1) —
  // используется, чтобы администратор мог просто посмотреть на ход турнира, не рискуя
  // случайно попасть в жеребьёвку/участники, если в этом же браузере у него ещё и
  // сохранён токен обычного игрока с оплаченной заявкой на этот же турнир.
  const isObserver = searchParams.get('observer') === '1';
  const { user, token: authToken, loading } = useAuth();
  const token = isObserver ? null : authToken;
  const [data, setData] = useState<HallData | null>(null);
  const [fetchError, setFetchError] = useState('');
  const [activeRound, setActiveRound] = useState<number | null>(null);
  const [pusherKey, setPusherKey] = useState<string | null>(null);
  const [pusherCluster, setPusherCluster] = useState<string | null>(null);
  const [nextRoundMs, setNextRoundMs] = useState<number | null>(null);
  const [redirectingGameId, setRedirectingGameId] = useState<number | null>(null);
  const [redirectStuck, setRedirectStuck] = useState(false);
  const knownGameIdRef = useRef<number | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const liveRoundNumberRef = useRef<number | null>(null);

  const fetchHall = useCallback(async (retriesLeft = 2) => {
    if (!tournamentId) return;
    try {
      const res = await fetch(`${HALL_URL}?tournament_id=${tournamentId}`, {
        headers: token ? { 'X-Auth-Token': token } : {},
      });
      const json = await res.json();
      if (!res.ok) {
        // Первая загрузка страницы (F5/переход) иногда попадает в кратковременный сбой
        // сети или "холодный старт" backend-функции — единичная неудача ещё не значит,
        // что зал действительно закрыт. Прежде чем показать пользователю жёсткий экран
        // "зал скоро откроется", тихо пробуем ещё пару раз с небольшой паузой. Экран
        // ошибки показываем только если это НЕ первая загрузка (тогда сообщение точно
        // осмысленное, например зал правда ещё не открыт) или все попытки исчерпаны.
        if (!hasLoadedOnceRef.current && retriesLeft > 0) {
          setTimeout(() => fetchHall(retriesLeft - 1), 1000);
          return;
        }
        setFetchError(json.error || 'Не удалось загрузить турнирный зал');
        return;
      }
      setData(json);
      setFetchError('');
      setPusherKey(json.pusher_key || null);
      setPusherCluster(json.pusher_cluster || null);
      setNextRoundMs(json.next_round_at ? new Date(json.next_round_at).getTime() - Date.now() : null);

      // Блок пар должен всегда показывать тур, который идёт прямо сейчас — как только
      // начинается новый тур (round_number с status 'active' меняется), автоматически
      // переключаемся на него. Пока текущий активный тур не менялся, пользователь может
      // спокойно полистать прошлые туры через список слева (ручной выбор не сбрасывается
      // на каждый опрос) — принудительный переброс происходит только при смене живого тура.
      const rounds: Round[] = json.rounds || [];
      const liveRound = rounds.find(r => r.status === 'active') || rounds[rounds.length - 1] || null;
      if (liveRound && liveRound.round_number !== liveRoundNumberRef.current) {
        liveRoundNumberRef.current = liveRound.round_number;
        setActiveRound(liveRound.round_number);
      }

      const newGameId: number | null = json.my_game_id || null;
      if (hasLoadedOnceRef.current && newGameId && newGameId !== knownGameIdRef.current) {
        setRedirectingGameId(newGameId);
      }
      knownGameIdRef.current = newGameId;
      hasLoadedOnceRef.current = true;
    } catch {
      if (!hasLoadedOnceRef.current && retriesLeft > 0) {
        setTimeout(() => fetchHall(retriesLeft - 1), 1000);
        return;
      }
      setFetchError('Не удалось загрузить турнирный зал');
    }
  }, [tournamentId, token, navigate]);

  useEffect(() => {
    fetchHall();
    // Резервный опрос на случай, если real-time соединение прервалось — раз в 12 секунд.
    // Интервал заодно обновляет отметку присутствия участника в зале (players[].online,
    // см. индикатор "онлайн" в турнирной таблице). Основные обновления приходят мгновенно
    // через Pusher — этот опрос только подстраховка, поэтому частить с ним незачем: при
    // нескольких одновременных турнирах именно частый опрос зала каждым участником создавал
    // основную нагрузку на БД.
    const interval = setInterval(fetchHall, 12000);
    return () => clearInterval(interval);
  }, [fetchHall]);

  // Живой обратный отсчёт до старта следующего тура, тикает раз в секунду
  useEffect(() => {
    if (nextRoundMs === null) return;
    const tick = setInterval(() => {
      setNextRoundMs(ms => {
        if (ms === null) return null;
        const next = ms - 1000;
        if (next <= 0) {
          fetchHall();
          return null;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [nextRoundMs !== null, fetchHall]);

  usePusherChannel(
    tournamentId ? `tournament-${tournamentId}` : null,
    pusherKey,
    pusherCluster,
    useCallback(() => { fetchHall(); }, [fetchHall]),
  );

  const connectionStatus = usePusherConnectionStatus(pusherKey, pusherCluster);

  // Push-события Pusher не хранятся и не повторяются: если во время короткого обрыва
  // связи (мобильный интернет моргнул, вкладка была свёрнута) игроку назначили партию —
  // уведомление об этом теряется безвозвратно, и он узнаёт о новой партии только на
  // следующем резервном опросе (раз в 20 секунд). Поэтому при восстановлении соединения
  // и при возврате на вкладку сразу принудительно подтягиваем актуальные данные зала,
  // не дожидаясь таймера (см. такое же решение в Game.tsx).
  const prevConnectionStatusRef = useRef<ConnectionStatus>(connectionStatus);
  useEffect(() => {
    const wasDisconnected = prevConnectionStatusRef.current !== 'connected';
    prevConnectionStatusRef.current = connectionStatus;
    if (connectionStatus === 'connected' && wasDisconnected) {
      fetchHall();
    }
  }, [connectionStatus, fetchHall]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchHall();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [fetchHall]);

  useEffect(() => {
    if (redirectingGameId === null) return;
    const timer = setTimeout(() => { navigate(`/game/${redirectingGameId}`); }, 1500);
    return () => clearTimeout(timer);
  }, [redirectingGameId, navigate]);

  // Иногда переход в начинающуюся партию (navigate) по неизвестной причине подвисает, и
  // оверлей "У Вас начинается партия" остаётся на экране навсегда — раньше спасало только
  // ручное обновление страницы пользователем. Подстраховка: если через 5 секунд переход
  // так и не случился, показываем это в сообщении и через секунду делаем принудительную
  // полную перезагрузку страницы (то самое обновление, которое до этого помогало вручную).
  useEffect(() => {
    if (redirectingGameId === null) { setRedirectStuck(false); return; }
    const stuckTimer = setTimeout(() => setRedirectStuck(true), 5000);
    const reloadTimer = setTimeout(() => {
      window.location.href = `/game/${redirectingGameId}`;
    }, 6000);
    return () => { clearTimeout(stuckTimer); clearTimeout(reloadTimer); };
  }, [redirectingGameId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Icon name="Loader2" size={32} className="animate-spin text-secondary" />
      </div>
    );
  }

  if (!user && !tournamentId) {
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
  const finishedGames = rounds.reduce((acc, r) => acc + r.games.filter(g => !g.is_bye && g.status === 'finished').length, 0);
  const whiteWins = rounds.reduce((acc, r) => acc + r.games.filter(g => !g.is_bye && g.result === '1-0').length, 0);
  const blackWins = rounds.reduce((acc, r) => acc + r.games.filter(g => !g.is_bye && g.result === '0-1').length, 0);
  const draws = rounds.reduce((acc, r) => acc + r.games.filter(g => !g.is_bye && g.result === '1/2-1/2').length, 0);
  const byes = rounds.reduce((acc, r) => acc + r.games.filter(g => g.is_bye).length, 0);
  const avgRating = players.length ? Math.round(players.reduce((a, p) => a + p.rating, 0) / players.length) : 0;
  const pct = (n: number) => finishedGames ? Math.round((n / finishedGames) * 100) : 0;

  const currentRound = rounds.find(r => r.round_number === activeRound) || rounds[rounds.length - 1];
  const isFinished = tournament.hall_status === 'finished';
  const isActive = tournament.hall_status === 'active';

  return (
    <div className="min-h-screen bg-muted text-foreground flex flex-col">
      <Seo title={`${tournament.title} — турнирный зал`} description="Турнирный зал" path={`/hall/${tournamentId}`} noindex />
      <Header />

      {isObserver && (
        <div className="bg-primary text-primary-foreground text-sm text-center py-2 px-4 flex items-center justify-center gap-2">
          <Icon name="Eye" size={14} /> Режим наблюдателя — вы смотрите зал со стороны, не как участник
        </div>
      )}

      {redirectingGameId !== null && (
        <div className="fixed inset-0 bg-primary/95 flex flex-col items-center justify-center z-50 px-4 text-center gap-4">
          <Icon name="Swords" size={40} className="text-secondary animate-pulse" />
          <p className="font-heading font-bold text-xl md:text-2xl text-white">
            У Вас начинается партия. Переход в игру
          </p>
          <Icon name="Loader2" size={24} className="text-white/70 animate-spin" />
          {redirectStuck && (
            <p className="text-sm text-white/70 max-w-sm">
              Переход задерживается — выполняется обновление страницы
            </p>
          )}
        </div>
      )}

      <main className="flex-1 py-6">
        <div className="container max-w-7xl mx-auto px-2 sm:px-8">
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
                  {tournament.time_control || '—'} · {RATING_TYPE_LABELS[tournament.rating_type || 'rapid']}
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

              {tournament.admin_message && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl shadow-sm p-4 flex gap-2.5">
                  <Icon name="Megaphone" size={18} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 leading-snug whitespace-pre-wrap">{tournament.admin_message}</p>
                </div>
              )}

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
                {isActive && nextRoundMs === null && <p className="text-sm text-emerald-600 font-medium mt-2 flex items-center justify-center gap-1"><Icon name="Radio" size={13} className="animate-pulse" /> Турнир идёт</p>}
                {tournament.hall_status === 'not_started' && <p className="text-sm text-gray-400 mt-2">Турнир ещё не начался</p>}
              </div>

              {isActive && nextRoundMs !== null && (
                <div className="bg-primary text-primary-foreground rounded-2xl shadow-sm p-5 text-center">
                  <p className="text-xs uppercase tracking-wide text-white/60 mb-1">Следующий тур через</p>
                  <p className="font-heading font-bold text-3xl text-secondary tabular-nums">{formatCountdown(nextRoundMs)}</p>
                </div>
              )}

              {/* Таблица участников */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 overflow-x-auto">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Турнирная таблица</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 text-xs uppercase">
                      <th className="pb-2 pr-2 font-medium">Место</th>
                      <th className="pb-2 pr-2 font-medium">Участник</th>
                      <th className="pb-2 pr-2 font-medium text-right">Рейтинг</th>
                      {rounds.map(r => (
                        <th key={r.round_number} className="pb-2 pr-2 font-medium text-center">Т{r.round_number}</th>
                      ))}
                      <th className="pb-2 pr-2 font-medium text-right">Очки</th>
                      <th className="pb-2 font-medium text-right">Бухгольц</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((p, i) => (
                      <tr key={p.id} className="border-t border-gray-50">
                        <td className="py-2 pr-2 text-gray-400">
                          {isFinished && p.place && p.place <= 3 ? (
                            <span className="inline-flex items-center gap-1">
                              <span>{p.place === 1 ? '🥇' : p.place === 2 ? '🥈' : '🥉'}</span>
                              <span className="font-semibold text-gray-600">{p.place}</span>
                            </span>
                          ) : (
                            p.place ?? i + 1
                          )}
                        </td>
                        <td className="py-2 pr-2 font-medium text-gray-800">
                          <span className="inline-flex items-center gap-1.5">
                            <PlayerLink userId={p.user_id} fio={p.fio} avatarUrl={p.avatar_url} avatarSize={22} />
                            {isActive && (
                              <span
                                title={p.online ? 'Онлайн' : 'Не в сети'}
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.online ? 'bg-green-500' : 'bg-gray-300'}`}
                              />
                            )}
                          </span>
                          {p.joined_late && (
                            <HoverCard>
                              <HoverCardTrigger asChild>
                                <span className="ml-1.5 inline-flex align-middle cursor-help">
                                  <Icon name="Clock" size={12} className="text-orange-400" />
                                </span>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-64 text-xs leading-relaxed">
                                Подключился(-ась) после начала турнира — за пропущенный 1-й тур начислено 0,5 очка, играет со следующего тура.
                              </HoverCardContent>
                            </HoverCard>
                          )}
                          {p.rating_delta !== null && (
                            <span className={`ml-1.5 text-xs font-semibold ${p.rating_delta > 0 ? 'text-emerald-600' : p.rating_delta < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                              {p.rating_delta > 0 ? '+' : ''}{Math.round(p.rating_delta)}
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-2 text-right text-gray-500">{p.rating}</td>
                        {rounds.map(r => {
                          const game = findPlayerRoundGame(p.id, r);
                          const score = playerRoundScore(p.id, game);
                          const clickable = !!game && !game.is_bye;
                          // Опоздавший участник не сыграл 1-й тур, но за него уже начислено 0,5 очка —
                          // показываем это в таблице вместо тире, а не пустую ячейку.
                          const lateJoinScore = !game && r.round_number === 1 && p.joined_late ? '½' : null;
                          return (
                            <td key={r.round_number} className="py-2 pr-2 text-center text-gray-600">
                              {clickable ? (
                                <RoundResultCell playerId={p.id} game={game!} score={score} gameHref={`/game/${game!.id}${isObserver ? '?observer=1' : ''}`} />
                              ) : score ? (
                                <span className="font-semibold text-gray-800">{score}</span>
                              ) : lateJoinScore ? (
                                <span className="font-semibold text-gray-800">{lateJoinScore}</span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2 pr-2 text-right font-bold text-primary">{p.points}</td>
                        <td className="py-2 text-right text-gray-500">{p.buchholz}</td>
                      </tr>
                    ))}
                    {players.length === 0 && (
                      <tr><td colSpan={5 + rounds.length} className="py-6 text-center text-gray-400">Участники ещё не зарегистрированы</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Пары текущего тура — всегда показывает тур, который идёт прямо сейчас
                  (activeRound автоматически переключается на него, см. fetchHall), но
                  через список туров слева можно вручную посмотреть и прошедшие туры.
                  Карточки партий компактные (py-2, gap-1.5), чтобы блок помещался
                  без лишней прокрутки даже при большом числе участников. */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-heading font-bold text-lg text-primary">Тур {currentRound?.round_number ?? '—'}</h2>
                  {currentRound && (
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${currentRound.status === 'active' ? 'bg-emerald-100 text-emerald-700' : currentRound.status === 'completed' ? 'bg-gray-100 text-gray-500' : 'bg-orange-100 text-orange-700'}`}>
                      {currentRound.status === 'active' ? 'Идёт' : currentRound.status === 'completed' ? 'Завершён' : 'Ожидание'}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  {currentRound?.games.map(g => (
                    <div
                      key={g.id}
                      onClick={g.is_bye ? undefined : () => navigate(`/game/${g.id}${isObserver ? '?observer=1' : ''}`)}
                      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-0 px-3 py-2 rounded-lg border border-gray-100 hover:bg-muted/50 transition-colors ${g.is_bye ? '' : 'cursor-pointer'}`}
                    >
                      {g.is_bye ? (
                        <span className="text-sm text-gray-600 flex items-center gap-2">
                          <Icon name="Moon" size={14} className="text-gray-400" />
                          <PlayerLink userId={g.white_user_id} fio={g.white_fio} avatarUrl={g.white_avatar_url} avatarSize={20} /> — технический бай (+1)
                        </span>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 min-w-0 sm:flex-1">
                            <span className="w-3 h-3 rounded-sm bg-white border border-gray-300 shrink-0" />
                            <PlayerLink userId={g.white_user_id} fio={g.white_fio} avatarUrl={g.white_avatar_url} avatarSize={22} className="text-sm font-medium text-gray-800 truncate" />
                          </div>
                          <div className="px-3 shrink-0 self-center">
                            {g.status === 'finished' ? (
                              <span className="text-sm font-bold text-primary">{RESULT_LABELS[g.result || ''] || g.result}</span>
                            ) : (
                              <span className="text-xs text-secondary hover:underline font-medium">Смотреть</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 min-w-0 sm:flex-1 sm:justify-end">
                            <PlayerLink userId={g.black_user_id} fio={g.black_fio} avatarUrl={g.black_avatar_url} avatarSize={22} className="text-sm font-medium text-gray-800 truncate order-2 sm:order-1 sm:text-right sm:flex-row-reverse" />
                            <span className="w-3 h-3 rounded-sm bg-gray-800 shrink-0 order-1 sm:order-2" />
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {!currentRound && <p className="text-sm text-gray-400 py-4 text-center">Пары появятся, когда организатор начнёт турнир</p>}
                </div>
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