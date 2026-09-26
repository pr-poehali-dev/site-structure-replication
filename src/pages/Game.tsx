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
import { getLegalTargets, getCheckedKingSquare } from '@/lib/chessMoves';
import { playMoveSound, playCaptureSound, playCheckSound, playGameEndSound, isSoundEnabled, setSoundEnabled } from '@/lib/sounds';
import func2url from '../../backend/func2url.json';

const CHESS_URL = func2url['chess-game'];
const HALL_URL = func2url['tournament-hall'];

interface MoveEntry {
  san: string;
  fen: string;
  color: 'white' | 'black';
  // Снимок часов сразу после этого хода — есть только у ходов, сделанных после введения
  // этой записи в БД; у партий постарше (сыгранных раньше) в истории этих полей нет.
  white_time_ms?: number;
  black_time_ms?: number;
}

interface GameData {
  id: number;
  status: string;
  result: string | null;
  result_reason: string | null;
  fen: string;
  pgn: string;
  turn: 'white' | 'black';
  moves: MoveEntry[];
  white_fio: string | null;
  black_fio: string | null;
  white_avatar_url: string | null;
  black_avatar_url: string | null;
  white_time_ms: number;
  black_time_ms: number;
  first_move_grace_ms: number | null;
  draw_offered_by: number | null;
  draw_offered_by_role: 'white' | 'black' | null;
  tournament_title: string;
  tournament_id: number;
  white_present?: boolean;
  black_present?: boolean;
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

interface ChatMsg {
  message: string;
  created_at: string;
  player_id: number | null;
  fio: string;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function pieceIcon(piece: string): string {
  const color = piece === piece.toUpperCase() ? 'w' : 'b';
  return `/chess-pieces/${color}${piece.toUpperCase()}.svg`;
}

const RESULT_REASON_LABELS: Record<string, string> = {
  checkmate: 'мат', stalemate: 'пат', draw_agreed: 'согласие сторон',
  resignation: 'сдача', timeout: 'закончилось время', insufficient_material: 'недостаточно материала для мата',
  bye: 'технический бай', first_move_timeout: 'не сделан первый ход за 1 минуту',
  threefold_repetition: 'троекратное повторение позиции',
};

function parseFen(fen: string): (string | null)[][] {
  const rows = fen.split(' ')[0].split('/');
  return rows.map(row => {
    const cells: (string | null)[] = [];
    for (const ch of row) {
      if (/\d/.test(ch)) {
        for (let i = 0; i < parseInt(ch, 10); i++) cells.push(null);
      } else {
        cells.push(ch);
      }
    }
    return cells;
  });
}

// Возвращает клетки, на которых доска отличается между двумя позициями —
// это клетки последнего хода (откуда ушла и куда пришла фигура; при рокировке
// и взятии на проходе таких клеток может быть больше двух).
function diffSquares(prevFen: string, currFen: string): string[] {
  const prevBoard = parseFen(prevFen);
  const currBoard = parseFen(currFen);
  const squares: string[] = [];
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      if (prevBoard[r]?.[f] !== currBoard[r]?.[f]) {
        squares.push(`${FILES[f]}${8 - r}`);
      }
    }
  }
  return squares;
}

function applyLocalMove(fen: string, from: string, to: string, promotion?: string): string {
  const parts = fen.split(' ');
  const rows = parts[0].split('/');
  const board: (string | null)[][] = rows.map(row => {
    const cells: (string | null)[] = [];
    for (const ch of row) {
      if (/\d/.test(ch)) { for (let i = 0; i < parseInt(ch, 10); i++) cells.push(null); }
      else cells.push(ch);
    }
    return cells;
  });
  const fileIdx = (f: string) => FILES.indexOf(f);
  const rowIdx = (rank: string) => 8 - parseInt(rank, 10);
  const fFile = fileIdx(from[0]), fRank = rowIdx(from[1]);
  const tFile = fileIdx(to[0]), tRank = rowIdx(to[1]);
  let piece = board[fRank]?.[fFile];
  if (!piece) return fen;
  const isWhite = piece === piece.toUpperCase();
  if (piece.toUpperCase() === 'P' && fFile !== tFile && !board[tRank][tFile]) {
    board[fRank][tFile] = null;
  }
  if (piece.toUpperCase() === 'K' && Math.abs(tFile - fFile) === 2) {
    if (tFile > fFile) { board[fRank][5] = board[fRank][7]; board[fRank][7] = null; }
    else { board[fRank][3] = board[fRank][0]; board[fRank][0] = null; }
  }
  board[fRank][fFile] = null;
  if (promotion) piece = isWhite ? promotion.toUpperCase() : promotion.toLowerCase();
  board[tRank][tFile] = piece;
  const newPlacement = board.map(row => {
    let s = ''; let empty = 0;
    for (const cell of row) {
      if (cell === null) empty++;
      else { if (empty) { s += empty; empty = 0; } s += cell; }
    }
    if (empty) s += empty;
    return s;
  }).join('/');
  parts[0] = newPlacement;
  parts[1] = parts[1] === 'w' ? 'b' : 'w';
  return parts.join(' ');
}

/** Разбивает "Фамилия Имя" на две строки для компактных карточек часов. */
function fioLines(fio: string): [string, string] {
  const idx = fio.indexOf(' ');
  if (idx === -1) return [fio, ''];
  return [fio.slice(0, idx), fio.slice(idx + 1)];
}

function formatClock(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatCountdown(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function Game() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromCabinet = searchParams.get('from') === 'cabinet';
  // Партию можно открыть из турнирного зала в режиме наблюдателя (?observer=1, см. Hall.tsx) —
  // администратор смотрит партию со стороны, без токена обычного игрока, чтобы случайно
  // не задействовать свой аккаунт как участника этой партии.
  const isObserver = searchParams.get('observer') === '1';
  const { user, token: authToken, loading } = useAuth();
  const token = isObserver ? null : authToken;
  const [game, setGame] = useState<GameData | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [myRole, setMyRole] = useState<'white' | 'black' | null>(null);
  const [fetchError, setFetchError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [moveError, setMoveError] = useState('');
  const [chatText, setChatText] = useState('');
  const [liveWhiteMs, setLiveWhiteMs] = useState(0);
  const [liveBlackMs, setLiveBlackMs] = useState(0);
  const [firstMoveGraceMs, setFirstMoveGraceMs] = useState<number | null>(null);
  const [promoChoice, setPromoChoice] = useState<{ from: string; to: string; isPremove?: boolean } | null>(null);
  const [premove, setPremove] = useState<{ from: string; to: string; promotion?: string } | null>(null);
  const [pusherKey, setPusherKey] = useState<string | null>(null);
  const [pusherCluster, setPusherCluster] = useState<string | null>(null);
  const [viewMoveIndex, setViewMoveIndex] = useState<number | null>(null);
  const [optimisticFen, setOptimisticFen] = useState<string | null>(null);
  const [redirectingGameId, setRedirectingGameId] = useState<number | null>(null);
  const [redirectStuck, setRedirectStuck] = useState(false);
  const [nextRoundMs, setNextRoundMs] = useState<number | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [boardFitSize, setBoardFitSize] = useState<number | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const boardSlotResizeObserverRef = useRef<ResizeObserver | null>(null);
  const knownGameIdRef = useRef<number | null>(null);
  const lastMoveCountRef = useRef<number | null>(null);
  const soundedFinishRef = useRef(false);

  // На десктопе (lg) страница занимает ровно 100vh без общей прокрутки (см. класс на
  // корневом div) — доска должна вписываться и по ширине, И по высоте экрана одновременно,
  // а не только по ширине, как раньше (тогда при невысоком окне доска вылезала за нижний
  // край экрана, и появлялась общая прокрутка). Боковые колонки растягиваются на всю высоту
  // ряда через CSS Grid (items/content-stretch на гриде ниже) — без ручной подгонки их
  // высоты под высоту доски через JS, как было раньше.
  //
  // "Слот" — гибкий контейнер вокруг доски (flex-1 внутри центральной колонки), который
  // растягивается на всё оставшееся вертикальное место. Измеряем его реальные ширину и
  // высоту и вычисляем максимальный размер квадратной доски, вписывающийся в обе стороны.
  //
  // Слот рендерится только когда game уже загружен (после ранних return'ов на loading/
  // !user/!game выше), поэтому обычный useEffect(..., []) с обычным ref не сработает —
  // он выполняется один раз при монтировании компонента, когда ref ещё указывает на null.
  // Callback-ref решает это: вызывается именно в момент, когда узел слота появляется в DOM.
  const boardSlotCallbackRef = useCallback((el: HTMLDivElement | null) => {
    boardSlotResizeObserverRef.current?.disconnect();
    boardSlotResizeObserverRef.current = null;
    if (!el) { setBoardFitSize(null); return; }
    const update = () => setBoardFitSize(Math.max(0, Math.floor(Math.min(el.clientWidth, el.clientHeight, 560))));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    boardSlotResizeObserverRef.current = observer;
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => { setSoundOn(isSoundEnabled()); }, []);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  }

  const fetchGame = useCallback(async () => {
    if (!gameId) return;
    try {
      const res = await fetch(`${CHESS_URL}?game_id=${gameId}`, {
        headers: token ? { 'X-Auth-Token': token } : {},
      });
      const json = await res.json();
      if (!res.ok) { setFetchError(json.error || 'Партия не найдена'); return; }
      setGame(json.game);
      setOptimisticFen(null);
      setChat(json.chat || []);
      setMyRole(json.my_role);
      setLiveWhiteMs(json.game.white_time_ms);
      setLiveBlackMs(json.game.black_time_ms);
      setFirstMoveGraceMs(json.game.first_move_grace_ms ?? null);
      setViewMoveIndex(prev => (prev !== null && json.game.moves && prev >= json.game.moves.length ? null : prev));
      setPusherKey(json.pusher_key || null);
      setPusherCluster(json.pusher_cluster || null);
      setFetchError('');
      if (knownGameIdRef.current === null) knownGameIdRef.current = json.game.id;
    } catch {
      setFetchError('Не удалось загрузить партию');
    }
  }, [gameId, token]);

  useEffect(() => {
    fetchGame();
    // Резервный опрос на случай, если real-time соединение прервалось — раз в 8 секунд
    // (было 4с, увеличено 26.09 после разбора нагрузки на БД: push-события доставляют
    // ходы мгновенно, а восстановление соединения/возврат на вкладку — см. ниже — уже
    // подтягивают данные сразу, без ожидания этого таймера). Интервал заодно обновляет
    // отметку присутствия игрока в партии (white_present/black_present, см. индикатор
    // "на связи" у соперника) — раз в 8с достаточно точно для этого индикатора.
    const interval = setInterval(fetchGame, 8000);
    return () => clearInterval(interval);
  }, [fetchGame]);

  // Данные хода приходят прямо в push-событии (см. game_update_payload на бэкенде) —
  // применяем их сразу, без отдельного HTTP-запроса за состоянием партии. Это убирает
  // лишний круг задержки, который был особенно заметен в быстрых партиях. На случай
  // неполного/устаревшего payload (старая версия бэкенда, обрыв соединения) падаем
  // обратно на полный fetchGame().
  const handleGameChannelEvent = useCallback((event: string, data: unknown) => {
    if (event === 'update' && data && typeof data === 'object' && 'fen' in data) {
      const upd = data as GameData;
      setGame(prev => (prev ? { ...prev, ...upd } : prev));
      setOptimisticFen(null);
      setLiveWhiteMs(upd.white_time_ms);
      setLiveBlackMs(upd.black_time_ms);
      // Событие приходит только когда партия уже началась/изменилась — льготный
      // период на первый ход к этому моменту всегда неактуален.
      setFirstMoveGraceMs(null);
      setViewMoveIndex(prev => (prev !== null && upd.moves && prev >= upd.moves.length ? null : prev));
      return;
    }
    if (event === 'chat' && data && typeof data === 'object' && 'message' in data) {
      const msg = data as { message: string; fio: string; player_id: number | null };
      setChat(prev => [...prev, { message: msg.message, fio: msg.fio, player_id: msg.player_id, created_at: new Date().toISOString() }]);
      return;
    }
    fetchGame();
  }, [fetchGame]);

  usePusherChannel(
    gameId ? `game-${gameId}` : null,
    pusherKey,
    pusherCluster,
    handleGameChannelEvent,
  );

  const connectionStatus = usePusherConnectionStatus(pusherKey, pusherCluster);

  // Push-события Pusher не хранятся и не повторяются: если во время короткого обрыва
  // связи (мобильный интернет моргнул, вкладка была свёрнута) соперник сделал ход —
  // это уведомление теряется безвозвратно, и игрок узнаёт о нём только на следующем
  // резервном опросе (раз в 15 секунд). В длинной партии это и давало ощутимые
  // задержки хода и рассинхрон часов. Поэтому при восстановлении соединения (переход
  // в 'connected' после 'disconnected'/'connecting') и при возврате на вкладку сразу
  // принудительно подтягиваем актуальное состояние партии, не дожидаясь таймера.
  const prevConnectionStatusRef = useRef<ConnectionStatus>(connectionStatus);
  useEffect(() => {
    const wasDisconnected = prevConnectionStatusRef.current !== 'connected';
    prevConnectionStatusRef.current = connectionStatus;
    if (connectionStatus === 'connected' && wasDisconnected) {
      fetchGame();
    }
  }, [connectionStatus, fetchGame]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchGame();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [fetchGame]);

  // Проверяет, не назначена ли игроку новая партия следующего тура — работает даже когда
  // игрок находится на странице уже завершённой партии, а не только в турнирном зале.
  // Заодно подтягивает отсчёт до старта следующего тура (next_round_at), чтобы его тоже
  // было видно здесь, а не только в зале.
  const checkNewGame = useCallback(async () => {
    if (!game || !token) return;
    try {
      const res = await fetch(`${HALL_URL}?tournament_id=${game.tournament_id}`, {
        headers: { 'X-Auth-Token': token },
      });
      const json = await res.json();
      setNextRoundMs(json.next_round_at ? new Date(json.next_round_at).getTime() - Date.now() : null);
      const newGameId: number | null = json.my_game_id || null;
      if (newGameId && newGameId !== knownGameIdRef.current) {
        knownGameIdRef.current = newGameId;
        setRedirectingGameId(newGameId);
      }
    } catch {
      // молча игнорируем — резервный опрос попробует снова
    }
  }, [game, token]);

  usePusherChannel(
    game ? `tournament-${game.tournament_id}` : null,
    pusherKey,
    pusherCluster,
    useCallback(() => { checkNewGame(); }, [checkNewGame]),
  );

  useEffect(() => {
    if (!game || game.status !== 'finished') return;
    checkNewGame();
    const interval = setInterval(checkNewGame, 10000);
    return () => clearInterval(interval);
  }, [game?.status, checkNewGame]);

  // Живой обратный отсчёт до старта следующего тура, тикает раз в секунду (та же логика,
  // что и в турнирном зале Hall.tsx).
  useEffect(() => {
    if (nextRoundMs === null) return;
    const tick = setInterval(() => {
      setNextRoundMs(ms => {
        if (ms === null) return null;
        const next = ms - 1000;
        if (next <= 0) {
          checkNewGame();
          return null;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [nextRoundMs !== null, checkNewGame]);

  useEffect(() => {
    if (redirectingGameId === null) return;
    const timer = setTimeout(() => { navigate(`/game/${redirectingGameId}`); }, 1500);
    return () => clearTimeout(timer);
  }, [redirectingGameId, navigate]);

  // Иногда переход на новую партию (navigate) по неизвестной причине подвисает, и
  // оверлей "У Вас начинается партия" остаётся на экране навсегда — раньше спасало
  // только ручное обновление страницы пользователем. Подстраховка: если через 5 секунд
  // после появления оверлея мы всё ещё на старом :gameId (переход не случился), считаем
  // переход зависшим — показываем это в сообщении и через секунду делаем принудительную
  // полную перезагрузку страницы (то самое обновление, которое до этого помогало вручную).
  useEffect(() => {
    if (redirectingGameId === null) { setRedirectStuck(false); return; }
    const stuckTimer = setTimeout(() => setRedirectStuck(true), 5000);
    const reloadTimer = setTimeout(() => {
      window.location.href = `/game/${redirectingGameId}`;
    }, 6000);
    return () => { clearTimeout(stuckTimer); clearTimeout(reloadTimer); };
  }, [redirectingGameId]);

  // Страница не перемонтируется при переходе со старой партии на новую (роут тот же
  // компонент, меняется только :gameId в адресе) — без явного сброса здесь оверлей
  // "У Вас начинается партия" остался бы висеть на экране навсегда поверх уже открытой
  // новой партии.
  useEffect(() => {
    setRedirectingGameId(null);
    setRedirectStuck(false);
    setNextRoundMs(null);
    knownGameIdRef.current = null;
  }, [gameId]);

  useEffect(() => {
    if (!game || game.status !== 'active') return;
    const inGrace = firstMoveGraceMs !== null;
    const tick = setInterval(() => {
      if (inGrace) {
        setFirstMoveGraceMs(ms => (ms === null ? null : Math.max(0, ms - 1000)));
      } else if (game.turn === 'white') {
        setLiveWhiteMs(ms => Math.max(0, ms - 1000));
      } else {
        setLiveBlackMs(ms => Math.max(0, ms - 1000));
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [game, firstMoveGraceMs !== null]);

  useEffect(() => {
    if (firstMoveGraceMs !== 0) return;
    fetchGame();
  }, [firstMoveGraceMs, fetchGame]);

  // Как только локальные часы кого-то из игроков дотикали до нуля — сразу опрашиваем
  // сервер, чтобы он проверил таймаут и завершил партию, не дожидаясь резервного опроса
  // раз в 15 секунд (раньше это давало заметную задержку между "0:00 на экране" и
  // фактическим завершением партии).
  useEffect(() => {
    if (!game || game.status !== 'active') return;
    if (firstMoveGraceMs !== null) return;
    if (liveWhiteMs > 0 && liveBlackMs > 0) return;
    fetchGame();
  }, [liveWhiteMs, liveBlackMs, game, firstMoveGraceMs, fetchGame]);

  // Как только наступает мой ход — пробуем выполнить запланированный предход.
  // Если он оказался невозможен (фигуру взяли, путь перекрыт и т.п.) — тихо отменяем.
  useEffect(() => {
    if (!premove || !game || !myRole) return;
    if (game.status !== 'active') { setPremove(null); return; }
    if (game.turn !== myRole || optimisticFen !== null) return;
    const targets = getLegalTargets(game.fen, premove.from);
    if (!targets.includes(premove.to)) {
      setPremove(null);
      return;
    }
    setOptimisticFen(applyLocalMove(game.fen, premove.from, premove.to, premove.promotion));
    const { from, to, promotion } = premove;
    setPremove(null);
    postAction('move', promotion ? { from, to, promotion } : { from, to }).then(ok => { if (!ok) setOptimisticFen(null); });
  }, [game, myRole, premove, optimisticFen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.length]);

  // Звук хода/взятия/шаха — определяем по нотации SAN последнего добавленного хода.
  useEffect(() => {
    if (!game) return;
    const moveList = game.moves || [];
    const count = moveList.length;
    if (lastMoveCountRef.current === null) {
      lastMoveCountRef.current = count;
      return;
    }
    if (count > lastMoveCountRef.current) {
      const lastSan = moveList[count - 1]?.san || '';
      if (lastSan.includes('+') || lastSan.includes('#')) {
        playCheckSound();
      } else if (lastSan.includes('x')) {
        playCaptureSound();
      } else {
        playMoveSound();
      }
    }
    lastMoveCountRef.current = count;
  }, [game?.moves?.length]);

  // Звук окончания партии — один раз при переходе в статус finished.
  useEffect(() => {
    if (!game || game.status !== 'finished' || soundedFinishRef.current) return;
    soundedFinishRef.current = true;
    let outcome: 'win' | 'loss' | 'draw' = 'draw';
    if (game.result === '1/2-1/2' || !myRole) {
      outcome = 'draw';
    } else if ((game.result === '1-0' && myRole === 'white') || (game.result === '0-1' && myRole === 'black')) {
      outcome = 'win';
    } else {
      outcome = 'loss';
    }
    playGameEndSound(outcome);
  }, [game?.status]);

  async function postAction(action: string, extra: Record<string, unknown> = {}) {
    if (!token) return;
    const res = await fetch(CHESS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token },
      body: JSON.stringify({ _action: action, game_id: Number(gameId), ...extra }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMoveError(data.error || 'Ошибка'); return false; }
    setMoveError('');
    fetchGame();
    return true;
  }

  function isMyTurn() {
    return !!game && !!myRole && game.status === 'active' && game.turn === myRole && optimisticFen === null;
  }

  function canPremove() {
    return !!game && !!myRole && game.status === 'active' && game.turn !== myRole && viewMoveIndex === null;
  }

  function isOwnPiece(piece: string | null): boolean {
    if (!piece || !myRole) return false;
    return (myRole === 'white' && piece === piece.toUpperCase()) || (myRole === 'black' && piece === piece.toLowerCase());
  }

  function pieceAtFen(fen: string, sqName: string): string | null {
    const board = parseFen(fen);
    const file = FILES.indexOf(sqName[0]);
    const rank = parseInt(sqName[1], 10) - 1;
    return board[7 - rank][file];
  }

  function pieceAt(sqName: string): string | null {
    if (!game) return null;
    return pieceAtFen(game.fen, sqName);
  }

  function attemptMove(from: string, to: string) {
    if (from === to || !game) return;
    // Проверяем легальность ДО любого визуального изменения — фигура не должна даже на
    // мгновение переместиться на клетку, куда ходить нельзя. Раньше ход сперва применялся
    // локально (optimisticFen), и только после отказа сервера откатывался обратно, из-за
    // чего невозможный ход был на экране доли секунды.
    if (!getLegalTargets(game.fen, from).includes(to)) return;
    const movingPiece = pieceAt(from);
    const isPawn = movingPiece && movingPiece.toUpperCase() === 'P';
    const destRank = to[1];
    if (isPawn && ((myRole === 'white' && destRank === '8') || (myRole === 'black' && destRank === '1'))) {
      setPromoChoice({ from, to });
      setSelected(null);
      return;
    }
    setOptimisticFen(applyLocalMove(game.fen, from, to));
    setSelected(null);
    postAction('move', { from, to }).then(ok => { if (!ok) setOptimisticFen(null); });
  }

  function queuePremove(from: string, to: string) {
    if (from === to || !game) return;
    const baseFen = premove ? applyLocalMove(game.fen, premove.from, premove.to, premove.promotion) : game.fen;
    // Та же проверка легальности для предхода: не даём поставить в очередь ход, который
    // прямо сейчас (в текущей позиции до ответа соперника) заведомо невозможен для этой фигуры.
    if (!getLegalTargets(baseFen, from).includes(to)) { setSelected(null); return; }
    const movingPiece = pieceAtFen(baseFen, from);
    const isPawn = movingPiece && movingPiece.toUpperCase() === 'P';
    const destRank = to[1];
    setSelected(null);
    if (isPawn && ((myRole === 'white' && destRank === '8') || (myRole === 'black' && destRank === '1'))) {
      setPromoChoice({ from, to, isPremove: true });
      return;
    }
    setPremove({ from, to });
  }

  function handleSquareClick(sqName: string, piece: string | null) {
    if (!game || !myRole || game.status !== 'active') return;
    if (viewMoveIndex !== null) return;

    if (!isMyTurn()) {
      if (!canPremove()) return;
      if (premove && (sqName === premove.from || sqName === premove.to)) {
        setPremove(null);
        setSelected(null);
        return;
      }
      if (!selected) {
        if (isOwnPiece(piece)) setSelected(sqName);
        return;
      }
      if (selected === sqName) { setSelected(null); return; }
      if (isOwnPiece(piece)) { setSelected(sqName); return; }
      queuePremove(selected, sqName);
      return;
    }

    if (!selected) {
      if (isOwnPiece(piece)) {
        setSelected(sqName);
      }
      return;
    }

    if (selected === sqName) { setSelected(null); return; }

    if (isOwnPiece(piece)) { setSelected(sqName); return; }

    attemptMove(selected, sqName);
  }

  function handleDragStart(sqName: string, piece: string | null) {
    if (!game || !myRole || game.status !== 'active') return;
    if (viewMoveIndex !== null) return;
    if (!isMyTurn() && !canPremove()) return;
    if (!isOwnPiece(piece)) return;
    setSelected(sqName);
  }

  function handleDrop(sqName: string) {
    if (!selected || viewMoveIndex !== null) return;
    if (selected === sqName) { setSelected(null); return; }
    if (isMyTurn()) {
      attemptMove(selected, sqName);
    } else if (canPremove()) {
      queuePremove(selected, sqName);
    }
  }

  async function handlePromotion(piece: string) {
    if (!promoChoice) return;
    if (promoChoice.isPremove) {
      setPremove({ from: promoChoice.from, to: promoChoice.to, promotion: piece });
      setPromoChoice(null);
      return;
    }
    setOptimisticFen(applyLocalMove(game!.fen, promoChoice.from, promoChoice.to, piece));
    const { from, to } = promoChoice;
    setPromoChoice(null);
    const ok = await postAction('move', { from, to, promotion: piece });
    if (!ok) setOptimisticFen(null);
  }

  async function handleSendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatText.trim()) return;
    const ok = await postAction('chat', { message: chatText.trim() });
    if (ok) setChatText('');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Icon name="Loader2" size={32} className="animate-spin text-secondary" />
      </div>
    );
  }

  if (!user && !isObserver) return <Navigate to="/login" replace />;

  if (fetchError && !game) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Seo title="Партия" description="Шахматная партия" noindex />
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
            <Icon name="AlertCircle" size={40} className="text-secondary mx-auto mb-4" />
            <p className="text-gray-500 text-sm mb-6">{fetchError}</p>
            <Link to="/cabinet"><Button variant="outline"><Icon name="ArrowLeft" size={16} className="mr-2" /> В кабинет</Button></Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Icon name="Loader2" size={32} className="animate-spin text-secondary" />
      </div>
    );
  }

  const moves = game.moves || [];
  const currentMoveIndex = viewMoveIndex === null ? moves.length - 1 : viewMoveIndex;
  const canGoPrev = moves.length > 0 && currentMoveIndex > -1;
  const canGoNext = viewMoveIndex !== null;

  function goToMove(idx: number) {
    if (idx >= moves.length - 1) setViewMoveIndex(null);
    else setViewMoveIndex(idx);
  }
  function goFirst() { setViewMoveIndex(-1); }
  function goPrev() { if (canGoPrev) goToMove(currentMoveIndex - 1); }
  function goNext() { if (canGoNext) goToMove(currentMoveIndex + 1); }
  function goLast() { setViewMoveIndex(null); }

  const displayedFen = viewMoveIndex === null
    ? (optimisticFen ?? (premove ? applyLocalMove(game.fen, premove.from, premove.to, premove.promotion) : game.fen))
    : viewMoveIndex === -1
      ? START_FEN
      : moves[viewMoveIndex]?.fen ?? game.fen;
  const board = parseFen(displayedFen);

  // Часы при просмотре истории: показываем снимок времени сразу после просматриваемого
  // хода (сохранён в moves[i].white_time_ms/black_time_ms). У партий, сыгранных до того,
  // как это стало записываться, и на позиции "до первого хода" снимка нет — тогда часы
  // просто скрываем (null), а не показываем неверное текущее/финальное время.
  const viewedMove = viewMoveIndex !== null && viewMoveIndex >= 0 ? moves[viewMoveIndex] : null;
  const shownWhiteMs = viewMoveIndex === null ? liveWhiteMs : (viewedMove?.white_time_ms ?? null);
  const shownBlackMs = viewMoveIndex === null ? liveBlackMs : (viewedMove?.black_time_ms ?? null);
  const clockText = (ms: number | null) => ms === null ? '—:--' : formatClock(ms);
  const legalTargets = selected && viewMoveIndex === null ? getLegalTargets(game.fen, selected) : [];
  const checkedKingSquare = getCheckedKingSquare(displayedFen);

  // Клетки последнего сделанного хода (откуда/куда) — подсвечиваются на доске,
  // чтобы было проще следить за партией. При просмотре истории показывает
  // клетки просматриваемого хода, иначе — последнего реального хода партии.
  let lastMoveSquares: string[] = [];
  if (viewMoveIndex === null) {
    if (moves.length > 0) {
      const prevFen = moves.length > 1 ? moves[moves.length - 2].fen : START_FEN;
      lastMoveSquares = diffSquares(prevFen, moves[moves.length - 1].fen);
    }
  } else if (viewMoveIndex >= 0) {
    const prevFen = viewMoveIndex === 0 ? START_FEN : moves[viewMoveIndex - 1].fen;
    lastMoveSquares = diffSquares(prevFen, moves[viewMoveIndex].fen);
  }
  const ranks = myRole === 'black' ? [...Array(8).keys()] : [...Array(8).keys()].reverse();
  const filesOrdered = myRole === 'black' ? [...FILES].reverse() : FILES;
  const finished = game.status === 'finished';
  const viewingPast = viewMoveIndex !== null;

  return (
    // На десктопе (lg и выше) страница ровно 100vh и без общей прокрутки — доска и боковые
    // колонки подстраиваются под высоту экрана, скролл остаётся только внутри чата и списка
    // ходов. На мобильных экранах высота свободная, как и раньше (там боковые колонки идут
    // друг под другом, ограничивать их высотой экрана не нужно и было бы неудобно).
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-muted text-foreground flex flex-col">
      <Seo title={`Партия — ${game.tournament_title}`} description="Шахматная партия" noindex />
      <Header />

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

      <main className="flex-1 py-6 px-2 sm:px-4 lg:py-4 lg:flex lg:flex-col lg:min-h-0 lg:overflow-hidden">
        <div className="w-full max-w-6xl mx-auto lg:px-4 lg:flex lg:flex-col lg:h-full lg:min-h-0">
          <div className="flex items-center justify-between gap-2 mb-4 lg:shrink-0">
            {fromCabinet ? (
              <Link to="/cabinet?tab=games" className="flex items-center gap-1.5 text-sm font-semibold text-secondary hover:text-primary transition-colors">
                <Icon name="ArrowLeft" size={16} /> В кабинет
              </Link>
            ) : (
              <Link to={`/hall/${game.tournament_id}`} className="flex items-center gap-1.5 text-sm font-semibold text-secondary hover:text-primary transition-colors">
                <Icon name="ArrowLeft" size={16} /> В турнирный зал
              </Link>
            )}
            <div className="flex items-center gap-3">
              {connectionStatus !== 'connected' && (
                <span
                  title={connectionStatus === 'connecting' ? 'Подключение к серверу...' : 'Связь с сервером прервана — данные могут быть неактуальны'}
                  className={`flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1 ${
                    connectionStatus === 'connecting'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-red-50 text-red-600 border border-red-200'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${connectionStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'}`} />
                  {connectionStatus === 'connecting' ? 'Подключение...' : 'Нет связи'}
                </span>
              )}
              <button
                onClick={toggleSound}
                title={soundOn ? 'Выключить звук' : 'Включить звук'}
                className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-primary transition-colors"
              >
                <Icon name={soundOn ? 'Volume2' : 'VolumeX'} size={17} />
              </button>
            </div>
          </div>

          {finished && nextRoundMs !== null && redirectingGameId === null && (
            <div className="bg-primary text-primary-foreground rounded-2xl shadow-sm p-4 text-center mb-4 flex items-center justify-center gap-3 lg:shrink-0">
              <Icon name="Clock" size={18} className="text-secondary" />
              <span className="text-sm text-white/70">Следующий тур через</span>
              <span className="font-heading font-bold text-2xl text-secondary tabular-nums">{formatCountdown(nextRoundMs)}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,560px)_300px] gap-6 justify-center lg:items-stretch lg:flex-1 lg:min-h-0">
            {/* ЛЕВАЯ КОЛОНКА: информация о партии + чат — растягивается на всю высоту ряда
                (items-stretch на гриде выше), совпадая с высотой доски в средней колонке.
                Скролл — только внутри чата. */}
            <div className="order-3 lg:order-1 flex flex-col gap-3 min-h-0 overflow-hidden">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 shrink-0">
                <Link to={`/hall/${game.tournament_id}`} className="flex items-start gap-2 text-sm font-semibold text-primary hover:text-secondary transition-colors mb-2">
                  <Icon name="Swords" size={16} className="text-secondary shrink-0 mt-0.5" />
                  <span className="break-words">{game.tournament_title}</span>
                </Link>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-sm bg-white border border-gray-300 inline-block shrink-0" />
                    <PlayerAvatar fio={game.white_fio} avatarUrl={game.white_avatar_url} size={20} />
                    <span className="font-medium text-gray-800 truncate">{shortFio(game.white_fio) || '—'}</span>
                    {!finished && (
                      <span
                        title={game.white_present ? 'Соперник на связи' : 'Нет на связи'}
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${game.white_present ? 'bg-green-500' : 'bg-gray-300'}`}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-sm bg-gray-800 inline-block shrink-0" />
                    <PlayerAvatar fio={game.black_fio} avatarUrl={game.black_avatar_url} size={20} />
                    <span className="font-medium text-gray-800 truncate">{shortFio(game.black_fio) || '—'}</span>
                    {!finished && (
                      <span
                        title={game.black_present ? 'Соперник на связи' : 'Нет на связи'}
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${game.black_present ? 'bg-green-500' : 'bg-gray-300'}`}
                      />
                    )}
                  </div>
                </div>
                {finished ? (
                  <p className="text-sm font-semibold text-primary bg-secondary/20 rounded-lg px-3 py-1.5 mt-2">
                    {gameOutcomeText(game.result, game.result_reason)}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">
                    {game.turn === 'white' ? 'Ход белых' : 'Ход чёрных'}
                  </p>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 flex flex-col flex-1 min-h-0">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 shrink-0">Чат</p>
                <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 min-h-0">
                  {chat.map((m, i) => (
                    <div key={i} className="text-sm">
                      <span className="font-medium text-primary">{shortFio(m.fio)}: </span>
                      <span className="text-gray-700">{m.message}</span>
                    </div>
                  ))}
                  {chat.length === 0 && <p className="text-sm text-gray-400">Сообщений пока нет</p>}
                  <div ref={chatEndRef} />
                </div>
                {myRole && (
                  <form onSubmit={handleSendChat} className="flex gap-2 mt-2 pt-2 border-t border-gray-100 shrink-0">
                    <input
                      value={chatText}
                      onChange={e => setChatText(e.target.value)}
                      placeholder="Сообщение..."
                      maxLength={500}
                      className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-secondary/50"
                    />
                    <Button type="submit" size="sm"><Icon name="Send" size={14} /></Button>
                  </form>
                )}
              </div>
            </div>

            {/* ЦЕНТР: ДОСКА */}
            <div className="order-1 lg:order-2 flex flex-col items-center gap-3 lg:h-full lg:min-h-0">
              {/* Часы соперника — на мобильных показываются над доской */}
              <div className={`lg:hidden w-full max-w-[560px] rounded-2xl border px-4 py-3 flex items-center justify-between transition-colors ${game.turn === (myRole === 'black' ? 'white' : 'black') && !finished ? 'bg-secondary border-secondary text-secondary-foreground shadow-lg shadow-secondary/30' : 'bg-white border-gray-100 text-gray-800 shadow-sm'}`}>
                <span className="font-medium flex items-center gap-2 min-w-0">
                  <span className="w-3 h-3 rounded-sm bg-gray-800 inline-block shrink-0 ring-1 ring-white/30" />
                  <PlayerAvatar
                    fio={myRole === 'black' ? game.white_fio : game.black_fio}
                    avatarUrl={myRole === 'black' ? game.white_avatar_url : game.black_avatar_url}
                    size={22}
                  />
                  <span className="flex flex-col leading-tight min-w-0">
                    {fioLines(shortFio(myRole === 'black' ? game.white_fio : game.black_fio) || '—').map((line, idx) => (
                      <span key={idx} className="truncate">{line}</span>
                    ))}
                  </span>
                </span>
                <span className="font-mono text-4xl md:text-5xl font-extrabold tabular-nums shrink-0">
                  {clockText(myRole === 'black' ? shownWhiteMs : shownBlackMs)}
                </span>
              </div>

              {/* На десктопе эти два баннера переехали в правую колонку (между часами
                  соперника и карточкой ходов, см. ниже) — там они не отнимают место у
                  доски и не сдвигают её вниз. На мобильных, где центральный блок и есть
                  единственная колонка, оставляем их здесь, над доской, как раньше. */}
              {firstMoveGraceMs !== null && !finished && (
                <div className="lg:hidden w-full max-w-[560px] bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl px-4 py-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Icon name="Clock" size={14} />
                    {myRole === 'white' ? 'Сделайте первый ход до окончания времени' : 'Ожидание первого хода соперника'}
                  </span>
                  <span className="font-mono font-semibold tabular-nums">{formatClock(firstMoveGraceMs)}</span>
                </div>
              )}

              {premove && !finished && (
                <div className="lg:hidden w-full max-w-[560px] bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl px-4 py-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Icon name="CornerDownRight" size={14} />
                    Предход: {premove.from} → {premove.to}
                  </span>
                  <button onClick={() => setPremove(null)} className="text-xs font-semibold underline hover:no-underline">
                    Отменить
                  </button>
                </div>
              )}

              {/* Слот растягивается на всё оставшееся место в колонке (flex-1) — по нему
                  измеряется, сколько места есть под доску и по ширине, и по высоте (см.
                  boardSlotCallbackRef). На мобильных слот не участвует в раскладке высоты
                  экрана, поэтому просто центрирует доску обычным образом. */}
              <div ref={boardSlotCallbackRef} className="w-full lg:flex-1 lg:min-h-0 flex items-center justify-center">
                <div
                  className="grid grid-cols-8 grid-rows-8 rounded-md overflow-hidden shadow-lg w-full max-w-[560px] aspect-square"
                  style={isDesktop && boardFitSize ? { width: boardFitSize, height: boardFitSize, maxWidth: boardFitSize } : undefined}
                >
                {ranks.map((rIdx, rowPos) => (
                  filesOrdered.map((f, colPos) => {
                    const fIdx = FILES.indexOf(f);
                    const piece = board[7 - rIdx][fIdx];
                    const sqName = `${f}${rIdx + 1}`;
                    const isLight = (fIdx + rIdx) % 2 === 1;
                    const isSelected = selected === sqName;
                    const isLastCol = colPos === 7;
                    const isLastRow = rowPos === 7;
                    const draggable = !!piece && isOwnPiece(piece) && (isMyTurn() || canPremove()) && viewMoveIndex === null;
                    const isLegalTarget = legalTargets.includes(sqName);
                    const isPremoveSquare = !!premove && (sqName === premove.from || sqName === premove.to);
                    const isCheckedKing = checkedKingSquare === sqName;
                    const isLastMoveSquare = lastMoveSquares.includes(sqName);
                    return (
                      <button
                        key={sqName}
                        onClick={() => handleSquareClick(sqName, piece)}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => { e.preventDefault(); handleDrop(sqName); }}
                        className={`relative aspect-square flex items-center justify-center text-3xl sm:text-4xl select-none
                          ${isLight ? 'bg-[#f0d9b5]' : 'bg-[#b58863]'}
                          ${isSelected ? 'ring-4 ring-secondary ring-inset' : ''}
                          ${isPremoveSquare ? 'ring-4 ring-amber-500 ring-inset' : ''}
                          ${isCheckedKing ? 'ring-4 ring-red-600 ring-inset' : ''}
                          ${isMyTurn() || canPremove() ? 'cursor-pointer' : 'cursor-default'}`}
                      >
                        {isLastMoveSquare && !isSelected && !isPremoveSquare && (
                          <span className="absolute inset-0 bg-yellow-300/40 pointer-events-none" />
                        )}
                        {isPremoveSquare && <span className="absolute inset-0 bg-amber-400/30 pointer-events-none" />}
                        {isCheckedKing && <span className="absolute inset-0 bg-red-500/25 pointer-events-none" />}
                        {isLastRow && (
                          <span className={`absolute left-0.5 bottom-0 text-[10px] sm:text-xs font-semibold select-none ${isLight ? 'text-[#b58863]' : 'text-[#f0d9b5]'}`}>
                            {f}
                          </span>
                        )}
                        {isLastCol && (
                          <span className={`absolute right-0.5 top-0 text-[10px] sm:text-xs font-semibold select-none ${isLight ? 'text-[#b58863]' : 'text-[#f0d9b5]'}`}>
                            {rIdx + 1}
                          </span>
                        )}
                        {isLegalTarget && !piece && (
                          <span className="absolute w-[30%] h-[30%] rounded-full bg-black/20 pointer-events-none" />
                        )}
                        {isLegalTarget && piece && (
                          <span className="absolute inset-[6%] rounded-full ring-[5px] ring-black/25 pointer-events-none" />
                        )}
                        {piece && (
                          <img
                            src={pieceIcon(piece)}
                            alt={piece}
                            draggable={draggable}
                            onDragStart={e => {
                              if (!draggable) { e.preventDefault(); return; }
                              handleDragStart(sqName, piece);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragEnd={() => setSelected(null)}
                            className={`w-[102%] h-[102%] select-none ${draggable ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
                          />
                        )}
                      </button>
                    );
                  })
                ))}
                </div>
              </div>

              {promoChoice && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
                  <div className="bg-white rounded-2xl p-5 shadow-xl">
                    <p className="text-sm font-medium text-gray-700 mb-3 text-center">Выберите фигуру для превращения</p>
                    <div className="flex gap-2">
                      {['Q', 'R', 'B', 'N'].map(p => (
                        <button key={p} onClick={() => handlePromotion(p)}
                          className="w-14 h-14 flex items-center justify-center bg-muted rounded-xl hover:bg-secondary/20 transition-colors">
                          <img src={pieceIcon(myRole === 'white' ? p : p.toLowerCase())} alt={p} className="w-[80%] h-[80%]" draggable={false} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Мои часы — на мобильных показываются сразу под доской, до ходов партии */}
              <div className={`lg:hidden w-full max-w-[560px] rounded-2xl border px-4 py-3 flex items-center justify-between transition-colors ${game.turn === (myRole === 'black' ? 'black' : 'white') && !finished ? 'bg-secondary border-secondary text-secondary-foreground shadow-lg shadow-secondary/30' : 'bg-white border-gray-100 text-gray-800 shadow-sm'}`}>
                <span className="font-medium flex items-center gap-2 min-w-0">
                  <span className="w-3 h-3 rounded-sm bg-white border border-gray-300 inline-block shrink-0" />
                  <PlayerAvatar
                    fio={myRole === 'black' ? game.black_fio : game.white_fio}
                    avatarUrl={myRole === 'black' ? game.black_avatar_url : game.white_avatar_url}
                    size={22}
                  />
                  <span className="flex flex-col leading-tight min-w-0">
                    {fioLines(shortFio(myRole === 'black' ? game.black_fio : game.white_fio) || '—').map((line, idx) => (
                      <span key={idx} className="truncate">{line}</span>
                    ))}
                  </span>
                </span>
                <span className="font-mono text-4xl md:text-5xl font-extrabold tabular-nums shrink-0">
                  {clockText(myRole === 'black' ? shownBlackMs : shownWhiteMs)}
                </span>
              </div>
            </div>

            {/* ПРАВАЯ КОЛОНКА: часы соперника, ходы, кнопки, свои часы — растягивается на
                всю высоту ряда (items-stretch на гриде выше), совпадая с высотой доски. */}
            <div className="order-2 lg:order-3 flex flex-col gap-3 min-h-0 overflow-hidden">
              {/* Часы соперника — верхняя граница правой колонки (на мобильных дублируются над доской, здесь скрыты) */}
              <div className={`hidden lg:flex rounded-2xl border px-4 py-3 items-center justify-between shrink-0 transition-colors ${game.turn === (myRole === 'black' ? 'white' : 'black') && !finished ? 'bg-secondary border-secondary text-secondary-foreground shadow-lg shadow-secondary/30' : 'bg-white border-gray-100 text-gray-800 shadow-sm'}`}>
                <span className="font-medium flex items-center gap-2 min-w-0">
                  <span className="w-3 h-3 rounded-sm bg-gray-800 inline-block shrink-0 ring-1 ring-white/30" />
                  <PlayerAvatar
                    fio={myRole === 'black' ? game.white_fio : game.black_fio}
                    avatarUrl={myRole === 'black' ? game.white_avatar_url : game.black_avatar_url}
                    size={22}
                  />
                  <span className="flex flex-col leading-tight min-w-0">
                    {fioLines(shortFio(myRole === 'black' ? game.white_fio : game.black_fio) || '—').map((line, idx) => (
                      <span key={idx} className="truncate">{line}</span>
                    ))}
                  </span>
                </span>
                <span className="font-mono text-4xl md:text-5xl font-extrabold tabular-nums shrink-0">
                  {clockText(myRole === 'black' ? shownWhiteMs : shownBlackMs)}
                </span>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col flex-1 min-h-0">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 shrink-0">Ходы партии</p>
                {moves.length > 0 && (
                  <>
                    <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-gray-100 shrink-0">
                      {viewingPast ? (
                        <span className="text-xs text-secondary flex items-center gap-1">
                          <Icon name="History" size={13} />
                          {viewMoveIndex === -1 ? 'До начала партии' : `После хода ${viewMoveIndex! + 1}`}
                        </span>
                      ) : <span />}
                      <button
                        onClick={() => setViewMoveIndex(null)}
                        disabled={!viewingPast}
                        className={`text-xs font-semibold underline hover:no-underline ${viewingPast ? 'text-primary' : 'text-gray-300 cursor-default no-underline'}`}
                      >
                        К текущей позиции
                      </button>
                    </div>
                    <div className="flex items-center justify-center gap-1 mb-2 shrink-0">
                      <button onClick={goFirst} disabled={!canGoPrev} className="p-1.5 rounded-lg text-primary hover:bg-secondary/15 disabled:opacity-30 disabled:hover:bg-transparent">
                        <Icon name="ChevronsLeft" size={18} />
                      </button>
                      <button onClick={goPrev} disabled={!canGoPrev} className="p-1.5 rounded-lg text-primary hover:bg-secondary/15 disabled:opacity-30 disabled:hover:bg-transparent">
                        <Icon name="ChevronLeft" size={18} />
                      </button>
                      <button onClick={goNext} disabled={!canGoNext} className="p-1.5 rounded-lg text-primary hover:bg-secondary/15 disabled:opacity-30 disabled:hover:bg-transparent">
                        <Icon name="ChevronRight" size={18} />
                      </button>
                      <button onClick={goLast} disabled={!canGoNext} className="p-1.5 rounded-lg text-primary hover:bg-secondary/15 disabled:opacity-30 disabled:hover:bg-transparent">
                        <Icon name="ChevronsRight" size={18} />
                      </button>
                    </div>
                    <div className="flex flex-col gap-1 text-sm font-mono font-semibold leading-relaxed flex-1 min-h-0 overflow-y-auto">
                      {Array.from({ length: Math.ceil(moves.length / 2) }).map((_, pairIdx) => {
                        const whiteIdx = pairIdx * 2;
                        const blackIdx = whiteIdx + 1;
                        return (
                          <div key={pairIdx} className="flex items-center gap-1">
                            <span className="text-gray-500 font-bold select-none">{pairIdx + 1}.</span>
                            <button
                              onClick={() => setViewMoveIndex(whiteIdx)}
                              className={`px-1.5 py-0.5 rounded transition-colors ${viewMoveIndex === whiteIdx ? 'bg-secondary text-white font-bold' : 'text-gray-900 hover:bg-secondary/20'}`}
                            >
                              {moves[whiteIdx].san}
                            </button>
                            {moves[blackIdx] && (
                              <button
                                onClick={() => setViewMoveIndex(blackIdx)}
                                className={`px-1.5 py-0.5 rounded transition-colors ${viewMoveIndex === blackIdx ? 'bg-secondary text-white font-bold' : 'text-gray-900 hover:bg-secondary/20'}`}
                              >
                                {moves[blackIdx].san}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {myRole && !finished && (
                  <div className="flex gap-2 shrink-0 mt-3 pt-3 border-t border-gray-100">
                    {game.draw_offered_by_role && game.draw_offered_by_role !== myRole ? (
                      <div className="flex flex-col gap-2 w-full">
                        <p className="text-sm text-center text-secondary font-medium">Соперник предлагает ничью</p>
                        <div className="flex gap-2">
                          <Button variant="outline" className="flex-1 animate-pulse border-secondary text-secondary hover:bg-secondary/10" onClick={() => postAction('accept_draw')}>
                            <Icon name="Check" size={15} className="mr-1" /> Принять
                          </Button>
                          <Button variant="outline" className="flex-1 animate-pulse border-secondary text-secondary hover:bg-secondary/10" onClick={() => postAction('decline_draw')}>
                            <Icon name="X" size={15} className="mr-1" /> Отклонить
                          </Button>
                        </div>
                      </div>
                    ) : game.draw_offered_by_role === myRole ? (
                      <div className="flex-1 flex items-center justify-center gap-2 text-sm text-gray-400 py-2">
                        <Icon name="Clock" size={14} /> Ничья предложена, ждём ответа
                      </div>
                    ) : (
                      <>
                        <Button variant="outline" className="flex-1" onClick={() => postAction('offer_draw')}>
                          <Icon name="Handshake" size={15} className="mr-1" /> Ничья
                        </Button>
                        <Button variant="outline" className="flex-1 text-red-500 border-red-200 hover:bg-red-50" onClick={() => { if (confirm('Сдать партию?')) postAction('resign'); }}>
                          <Icon name="Flag" size={15} className="mr-1" /> Сдаться
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {/* Отсчёт на первый ход и предход — на десктопе показываются здесь, внутри
                    карточки ходов, а не над доской/в центральной колонке (см. скриншот
                    задачи). Как и ошибка хода с итогом партии ниже, размещены внутри этой
                    карточки, а не отдельными блоками снизу — так высота правой колонки не
                    "плывёт" и остаётся равна высоте доски: список ходов выше просто ужимается
                    (у него своя внутренняя прокрутка), а сама колонка не растёт. */}
                {firstMoveGraceMs !== null && !finished && (
                  <div className="hidden lg:flex bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl px-3 py-2 items-center justify-between gap-2 shrink-0 mt-2">
                    <span className="flex items-center gap-2">
                      <Icon name="Clock" size={14} />
                      {myRole === 'white' ? 'Сделайте первый ход до окончания времени' : 'Ожидание первого хода соперника'}
                    </span>
                    <span className="font-mono font-semibold tabular-nums">{formatClock(firstMoveGraceMs)}</span>
                  </div>
                )}

                {premove && !finished && (
                  <div className="hidden lg:flex bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl px-3 py-2 items-center justify-between gap-2 shrink-0 mt-2">
                    <span className="flex items-center gap-2">
                      <Icon name="CornerDownRight" size={14} />
                      Предход: {premove.from} → {premove.to}
                    </span>
                    <button onClick={() => setPremove(null)} className="text-xs font-semibold underline hover:no-underline">
                      Отменить
                    </button>
                  </div>
                )}

                {/* Ошибка хода и итог партии — внутри карточки ходов, а не отдельными
                    блоками снизу, чтобы общая высота колонки не "плыла" и не выходила
                    за пределы доски. */}
                {moveError && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-3 py-2 flex items-center gap-2 shrink-0 mt-2">
                    <Icon name="AlertCircle" size={14} /> {moveError}
                  </div>
                )}

                {finished && (
                  <div className="bg-secondary/10 border border-secondary/30 rounded-xl px-4 py-3 text-center shrink-0 mt-3">
                    <p className="font-heading font-bold text-base text-primary mb-0.5">
                      {RESULT_LABELS(game.result)}
                    </p>
                    <p className="text-xs text-gray-500">{RESULT_REASON_LABELS[game.result_reason || ''] || game.result_reason}</p>
                  </div>
                )}
              </div>

              {/* Часы игрока (мои) — нижняя граница правой колонки, совпадает с нижней
                  границей доски. На мобильных дублируются под доской, здесь скрыты. */}
              <div className={`hidden lg:flex rounded-2xl border px-4 py-3 items-center justify-between shrink-0 transition-colors ${game.turn === (myRole === 'black' ? 'black' : 'white') && !finished ? 'bg-secondary border-secondary text-secondary-foreground shadow-lg shadow-secondary/30' : 'bg-white border-gray-100 text-gray-800 shadow-sm'}`}>
                <span className="font-medium flex items-center gap-2 min-w-0">
                  <span className="w-3 h-3 rounded-sm bg-white border border-gray-300 inline-block shrink-0" />
                  <PlayerAvatar
                    fio={myRole === 'black' ? game.black_fio : game.white_fio}
                    avatarUrl={myRole === 'black' ? game.black_avatar_url : game.white_avatar_url}
                    size={22}
                  />
                  <span className="flex flex-col leading-tight min-w-0">
                    {fioLines(shortFio(myRole === 'black' ? game.black_fio : game.white_fio) || '—').map((line, idx) => (
                      <span key={idx} className="truncate">{line}</span>
                    ))}
                  </span>
                </span>
                <span className="font-mono text-4xl md:text-5xl font-extrabold tabular-nums shrink-0">
                  {clockText(myRole === 'black' ? shownBlackMs : shownWhiteMs)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* На десктопе страница занимает ровно 100vh без общей прокрутки (см. класс на корневом
          div) — футер туда не помещается и не нужен во время игры, поэтому скрыт на lg+.
          На мобильных высота свободная, футер остаётся как на всех остальных страницах. */}
      <div className="lg:hidden">
        <Footer />
      </div>
    </div>
  );
}

function RESULT_LABELS(result: string | null): string {
  if (result === '1-0') return 'Победа белых';
  if (result === '0-1') return 'Победа чёрных';
  if (result === '1/2-1/2') return 'Ничья';
  return result || '';
}

function gameOutcomeText(result: string | null, reason: string | null): string {
  if (reason === 'checkmate') return result === '1-0' ? 'Белые поставили мат' : 'Чёрные поставили мат';
  if (reason === 'stalemate') return 'Ничья: пат';
  if (reason === 'draw_agreed') return 'Ничья по соглашению сторон';
  if (reason === 'insufficient_material') return 'Ничья: недостаточно материала для мата';
  if (reason === 'threefold_repetition') return 'Ничья: троекратное повторение позиции';
  if (reason === 'resignation') return result === '1-0' ? 'Чёрные сдались' : 'Белые сдались';
  if (reason === 'timeout') return result === '1-0' ? 'Чёрные просрочили время' : 'Белые просрочили время';
  if (reason === 'first_move_timeout') return 'Белые не сделали первый ход вовремя';
  if (reason === 'bye') return 'Технический бай';
  return RESULT_LABELS(result);
}