import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Navigate, Link } from 'react-router-dom';
import { Header, Footer } from '@/components/Layout';
import Seo from '@/components/Seo';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { usePusherChannel } from '@/hooks/usePusherChannel';
import { shortFio } from '@/lib/fio';
import PlayerAvatar from '@/components/PlayerAvatar';
import { getLegalTargets } from '@/lib/chessMoves';
import { playMoveSound, playCaptureSound, playCheckSound, playGameEndSound, isSoundEnabled, setSoundEnabled } from '@/lib/sounds';
import func2url from '../../backend/func2url.json';

const CHESS_URL = func2url['chess-game'];
const HALL_URL = func2url['tournament-hall'];

interface MoveEntry {
  san: string;
  fen: string;
  color: 'white' | 'black';
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
  bye: 'технический бай', first_move_timeout: 'не сделан первый ход за 30 секунд',
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

function formatClock(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function Game() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromCabinet = searchParams.get('from') === 'cabinet';
  const { user, token, loading } = useAuth();
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
  const [promoChoice, setPromoChoice] = useState<{ from: string; to: string } | null>(null);
  const [pusherKey, setPusherKey] = useState<string | null>(null);
  const [pusherCluster, setPusherCluster] = useState<string | null>(null);
  const [viewMoveIndex, setViewMoveIndex] = useState<number | null>(null);
  const [optimisticFen, setOptimisticFen] = useState<string | null>(null);
  const [redirectingGameId, setRedirectingGameId] = useState<number | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const knownGameIdRef = useRef<number | null>(null);
  const lastMoveCountRef = useRef<number | null>(null);
  const soundedFinishRef = useRef(false);

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
    // Резервный опрос на случай, если real-time соединение прервалось
    const interval = setInterval(fetchGame, 15000);
    return () => clearInterval(interval);
  }, [fetchGame]);

  usePusherChannel(
    gameId ? `game-${gameId}` : null,
    pusherKey,
    pusherCluster,
    useCallback(() => { fetchGame(); }, [fetchGame]),
  );

  // Проверяет, не назначена ли игроку новая партия следующего тура —
  // работает даже когда игрок находится на странице уже завершённой партии,
  // а не только в турнирном зале.
  const checkNewGame = useCallback(async () => {
    if (!game || !token) return;
    try {
      const res = await fetch(`${HALL_URL}?tournament_id=${game.tournament_id}`, {
        headers: { 'X-Auth-Token': token },
      });
      const json = await res.json();
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

  useEffect(() => {
    if (redirectingGameId === null) return;
    const timer = setTimeout(() => { navigate(`/game/${redirectingGameId}`); }, 1500);
    return () => clearTimeout(timer);
  }, [redirectingGameId, navigate]);

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

  function isOwnPiece(piece: string | null): boolean {
    if (!piece || !myRole) return false;
    return (myRole === 'white' && piece === piece.toUpperCase()) || (myRole === 'black' && piece === piece.toLowerCase());
  }

  function attemptMove(from: string, to: string) {
    if (from === to) return;
    const movingPiece = pieceAt(from);
    const isPawn = movingPiece && movingPiece.toUpperCase() === 'P';
    const destRank = to[1];
    if (isPawn && ((myRole === 'white' && destRank === '8') || (myRole === 'black' && destRank === '1'))) {
      setPromoChoice({ from, to });
      setSelected(null);
      return;
    }
    setOptimisticFen(applyLocalMove(game!.fen, from, to));
    setSelected(null);
    postAction('move', { from, to }).then(ok => { if (!ok) setOptimisticFen(null); });
  }

  function handleSquareClick(sqName: string, piece: string | null) {
    if (!game || !myRole || game.status !== 'active') return;
    if (viewMoveIndex !== null) return;
    if (!isMyTurn()) return;

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
    if (viewMoveIndex !== null || !isMyTurn()) return;
    if (!isOwnPiece(piece)) return;
    setSelected(sqName);
  }

  function handleDrop(sqName: string) {
    if (!selected || !isMyTurn() || viewMoveIndex !== null) return;
    if (selected === sqName) { setSelected(null); return; }
    attemptMove(selected, sqName);
  }

  function pieceAt(sqName: string): string | null {
    if (!game) return null;
    const board = parseFen(game.fen);
    const file = FILES.indexOf(sqName[0]);
    const rank = parseInt(sqName[1], 10) - 1;
    return board[7 - rank][file];
  }

  async function handlePromotion(piece: string) {
    if (!promoChoice) return;
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

  if (!user) return <Navigate to="/login" replace />;

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
    ? (optimisticFen ?? game.fen)
    : viewMoveIndex === -1
      ? START_FEN
      : moves[viewMoveIndex]?.fen ?? game.fen;
  const board = parseFen(displayedFen);
  const legalTargets = selected && viewMoveIndex === null ? getLegalTargets(displayedFen, selected) : [];
  const ranks = myRole === 'black' ? [...Array(8).keys()] : [...Array(8).keys()].reverse();
  const filesOrdered = myRole === 'black' ? [...FILES].reverse() : FILES;
  const finished = game.status === 'finished';
  const viewingPast = viewMoveIndex !== null;

  return (
    <div className="min-h-screen bg-muted text-foreground flex flex-col">
      <Seo title={`Партия — ${game.tournament_title}`} description="Шахматная партия" noindex />
      <Header />

      {redirectingGameId !== null && (
        <div className="fixed inset-0 bg-primary/95 flex flex-col items-center justify-center z-50 px-4 text-center gap-4">
          <Icon name="Swords" size={40} className="text-secondary animate-pulse" />
          <p className="font-heading font-bold text-xl md:text-2xl text-white">
            У Вас начинается партия. Переход в игру
          </p>
          <Icon name="Loader2" size={24} className="text-white/70 animate-spin" />
        </div>
      )}

      <main className="flex-1 py-6 px-4">
        <div className="container max-w-6xl mx-auto">
          <div className="flex items-center justify-between gap-2 mb-4">
            {fromCabinet ? (
              <Link to="/cabinet?tab=games" className="flex items-center gap-1.5 text-sm font-semibold text-secondary hover:text-primary transition-colors">
                <Icon name="ArrowLeft" size={16} /> В кабинет
              </Link>
            ) : (
              <Link to={`/hall/${game.tournament_id}`} className="flex items-center gap-1.5 text-sm font-semibold text-secondary hover:text-primary transition-colors">
                <Icon name="ArrowLeft" size={16} /> В турнирный зал
              </Link>
            )}
            <button
              onClick={toggleSound}
              title={soundOn ? 'Выключить звук' : 'Включить звук'}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-primary transition-colors"
            >
              <Icon name={soundOn ? 'Volume2' : 'VolumeX'} size={17} />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,560px)_300px] gap-6 justify-center items-stretch">
            {/* ЛЕВАЯ КОЛОНКА: информация о партии + чат */}
            <div className="order-3 lg:order-1 flex flex-col gap-4 min-h-0">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 shrink-0">
                <Link to={`/hall/${game.tournament_id}`} className="flex items-center gap-2 text-sm font-semibold text-primary hover:text-secondary transition-colors mb-3">
                  <Icon name="Swords" size={16} className="text-secondary shrink-0" />
                  <span className="truncate">{game.tournament_title}</span>
                </Link>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded-sm bg-gray-800 inline-block shrink-0" />
                    <PlayerAvatar fio={game.white_fio} avatarUrl={game.white_avatar_url} size={22} />
                    <span className="font-medium text-gray-800 truncate">{shortFio(game.white_fio) || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded-sm bg-white border border-gray-300 inline-block shrink-0" />
                    <PlayerAvatar fio={game.black_fio} avatarUrl={game.black_avatar_url} size={22} />
                    <span className="font-medium text-gray-800 truncate">{shortFio(game.black_fio) || '—'}</span>
                  </div>
                </div>
                {finished ? (
                  <p className="text-sm font-semibold text-primary bg-secondary/20 rounded-lg px-3 py-2 mt-3">
                    {gameOutcomeText(game.result, game.result_reason)}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
                    {game.turn === 'white' ? 'Ход белых' : 'Ход чёрных'}
                  </p>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col flex-1 min-h-0">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Чат</p>
                <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
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
                  <form onSubmit={handleSendChat} className="flex gap-2 mt-2 pt-2 border-t border-gray-100">
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
            <div className="order-1 lg:order-2 flex flex-col items-center gap-3">
              {/* Часы соперника — на мобильных показываются над доской */}
              <div className={`lg:hidden w-full max-w-[560px] rounded-2xl shadow-sm border px-4 py-3 flex items-center justify-between ${game.turn === (myRole === 'black' ? 'white' : 'black') && !finished ? 'bg-primary border-primary text-primary-foreground' : 'bg-white border-gray-100 text-gray-800'}`}>
                <span className="font-medium flex items-center gap-2 min-w-0">
                  <span className="w-3 h-3 rounded-sm bg-gray-800 inline-block shrink-0 ring-1 ring-white/30" />
                  <PlayerAvatar
                    fio={myRole === 'black' ? game.white_fio : game.black_fio}
                    avatarUrl={myRole === 'black' ? game.white_avatar_url : game.black_avatar_url}
                    size={22}
                  />
                  <span className="truncate">{shortFio(myRole === 'black' ? game.white_fio : game.black_fio) || '—'}</span>
                </span>
                <span className="font-mono text-xl font-bold tabular-nums shrink-0">
                  {formatClock(myRole === 'black' ? liveWhiteMs : liveBlackMs)}
                </span>
              </div>

              {firstMoveGraceMs !== null && !finished && (
                <div className="w-full max-w-[560px] bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl px-4 py-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Icon name="Clock" size={14} />
                    {myRole === 'white' ? 'Сделайте первый ход до окончания времени' : 'Ожидание первого хода соперника'}
                  </span>
                  <span className="font-mono font-semibold tabular-nums">{formatClock(firstMoveGraceMs)}</span>
                </div>
              )}

              <div className="grid grid-cols-8 grid-rows-8 rounded-md overflow-hidden shadow-lg w-full max-w-[560px] aspect-square">
                {ranks.map((rIdx, rowPos) => (
                  filesOrdered.map((f, colPos) => {
                    const fIdx = FILES.indexOf(f);
                    const piece = board[7 - rIdx][fIdx];
                    const sqName = `${f}${rIdx + 1}`;
                    const isLight = (fIdx + rIdx) % 2 === 1;
                    const isSelected = selected === sqName;
                    const isLastCol = colPos === 7;
                    const isLastRow = rowPos === 7;
                    const draggable = !!piece && isOwnPiece(piece) && isMyTurn() && viewMoveIndex === null;
                    const isLegalTarget = legalTargets.includes(sqName);
                    return (
                      <button
                        key={sqName}
                        onClick={() => handleSquareClick(sqName, piece)}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => { e.preventDefault(); handleDrop(sqName); }}
                        className={`relative aspect-square flex items-center justify-center text-3xl sm:text-4xl select-none
                          ${isLight ? 'bg-[#f0d9b5]' : 'bg-[#b58863]'}
                          ${isSelected ? 'ring-4 ring-secondary ring-inset' : ''}
                          ${isMyTurn() ? 'cursor-pointer' : 'cursor-default'}`}
                      >
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
                            className={`w-[80%] h-[80%] select-none ${draggable ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
                          />
                        )}
                      </button>
                    );
                  })
                ))}
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
              <div className={`lg:hidden w-full max-w-[560px] rounded-2xl shadow-sm border px-4 py-3 flex items-center justify-between ${game.turn === (myRole === 'black' ? 'black' : 'white') && !finished ? 'bg-primary border-primary text-primary-foreground' : 'bg-white border-gray-100 text-gray-800'}`}>
                <span className="font-medium flex items-center gap-2 min-w-0">
                  <span className="w-3 h-3 rounded-sm bg-white border border-gray-300 inline-block shrink-0" />
                  <PlayerAvatar
                    fio={myRole === 'black' ? game.black_fio : game.white_fio}
                    avatarUrl={myRole === 'black' ? game.black_avatar_url : game.white_avatar_url}
                    size={22}
                  />
                  <span className="truncate">{shortFio(myRole === 'black' ? game.black_fio : game.white_fio) || '—'}</span>
                </span>
                <span className="font-mono text-xl font-bold tabular-nums shrink-0">
                  {formatClock(myRole === 'black' ? liveBlackMs : liveWhiteMs)}
                </span>
              </div>
            </div>

            {/* ПРАВАЯ КОЛОНКА: часы соперника, ходы, кнопки, свои часы */}
            <div className="order-2 lg:order-3 flex flex-col gap-4 min-h-0">
              {/* Часы соперника (на мобильных дублируются над доской, здесь скрыты) */}
              <div className={`hidden lg:flex rounded-2xl shadow-sm border px-4 py-3 items-center justify-between shrink-0 ${game.turn === (myRole === 'black' ? 'white' : 'black') && !finished ? 'bg-primary border-primary text-primary-foreground' : 'bg-white border-gray-100 text-gray-800'}`}>
                <span className="font-medium flex items-center gap-2 min-w-0">
                  <span className="w-3 h-3 rounded-sm bg-gray-800 inline-block shrink-0 ring-1 ring-white/30" />
                  <PlayerAvatar
                    fio={myRole === 'black' ? game.white_fio : game.black_fio}
                    avatarUrl={myRole === 'black' ? game.white_avatar_url : game.black_avatar_url}
                    size={22}
                  />
                  <span className="truncate">{shortFio(myRole === 'black' ? game.white_fio : game.black_fio) || '—'}</span>
                </span>
                <span className="font-mono text-xl font-bold tabular-nums shrink-0">
                  {formatClock(myRole === 'black' ? liveWhiteMs : liveBlackMs)}
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
              </div>

              {/* Часы игрока (мои) — на мобильных дублируются под доской, здесь скрыты */}
              <div className={`hidden lg:flex rounded-2xl shadow-sm border px-4 py-3 items-center justify-between shrink-0 ${game.turn === (myRole === 'black' ? 'black' : 'white') && !finished ? 'bg-primary border-primary text-primary-foreground' : 'bg-white border-gray-100 text-gray-800'}`}>
                <span className="font-medium flex items-center gap-2 min-w-0">
                  <span className="w-3 h-3 rounded-sm bg-white border border-gray-300 inline-block shrink-0" />
                  <PlayerAvatar
                    fio={myRole === 'black' ? game.black_fio : game.white_fio}
                    avatarUrl={myRole === 'black' ? game.black_avatar_url : game.white_avatar_url}
                    size={22}
                  />
                  <span className="truncate">{shortFio(myRole === 'black' ? game.black_fio : game.white_fio) || '—'}</span>
                </span>
                <span className="font-mono text-xl font-bold tabular-nums shrink-0">
                  {formatClock(myRole === 'black' ? liveBlackMs : liveWhiteMs)}
                </span>
              </div>

              {moveError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2 flex items-center gap-2 shrink-0">
                  <Icon name="AlertCircle" size={14} /> {moveError}
                </div>
              )}

              {finished && (
                <div className="bg-white border border-gray-100 rounded-xl px-5 py-4 text-center shadow-sm shrink-0">
                  <p className="font-heading font-bold text-lg text-primary mb-1">
                    {RESULT_LABELS(game.result)}
                  </p>
                  <p className="text-sm text-gray-500">{RESULT_REASON_LABELS[game.result_reason || ''] || game.result_reason}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
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
  if (reason === 'resignation') return result === '1-0' ? 'Чёрные сдались' : 'Белые сдались';
  if (reason === 'timeout') return result === '1-0' ? 'Чёрные просрочили время' : 'Белые просрочили время';
  if (reason === 'first_move_timeout') return 'Белые не сделали первый ход вовремя';
  if (reason === 'bye') return 'Технический бай';
  return RESULT_LABELS(result);
}