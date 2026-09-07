import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { Header, Footer } from '@/components/Layout';
import Seo from '@/components/Seo';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { usePusherChannel } from '@/hooks/usePusherChannel';
import func2url from '../../backend/func2url.json';

const CHESS_URL = func2url['chess-game'];

interface GameData {
  id: number;
  status: string;
  result: string | null;
  result_reason: string | null;
  fen: string;
  pgn: string;
  turn: 'white' | 'black';
  white_fio: string | null;
  black_fio: string | null;
  white_time_ms: number;
  black_time_ms: number;
  draw_offered_by: number | null;
  tournament_title: string;
  tournament_id: number;
}

interface ChatMsg {
  message: string;
  created_at: string;
  player_id: number | null;
  fio: string;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const UNICODE: Record<string, string> = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

const RESULT_REASON_LABELS: Record<string, string> = {
  checkmate: 'мат', stalemate: 'пат', draw_agreed: 'согласие сторон',
  resignation: 'сдача', timeout: 'закончилось время', insufficient_material: 'недостаточно материала для мата',
  bye: 'технический бай',
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

function formatClock(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function Game() {
  const { gameId } = useParams();
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
  const [promoChoice, setPromoChoice] = useState<{ from: string; to: string } | null>(null);
  const [pusherKey, setPusherKey] = useState<string | null>(null);
  const [pusherCluster, setPusherCluster] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchGame = useCallback(async () => {
    if (!gameId) return;
    try {
      const res = await fetch(`${CHESS_URL}?game_id=${gameId}`, {
        headers: token ? { 'X-Auth-Token': token } : {},
      });
      const json = await res.json();
      if (!res.ok) { setFetchError(json.error || 'Партия не найдена'); return; }
      setGame(json.game);
      setChat(json.chat || []);
      setMyRole(json.my_role);
      setLiveWhiteMs(json.game.white_time_ms);
      setLiveBlackMs(json.game.black_time_ms);
      setPusherKey(json.pusher_key || null);
      setPusherCluster(json.pusher_cluster || null);
      setFetchError('');
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

  useEffect(() => {
    if (!game || game.status !== 'active') return;
    const tick = setInterval(() => {
      if (game.turn === 'white') setLiveWhiteMs(ms => Math.max(0, ms - 1000));
      else setLiveBlackMs(ms => Math.max(0, ms - 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [game]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.length]);

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
    return !!game && !!myRole && game.status === 'active' && game.turn === myRole;
  }

  function handleSquareClick(sqName: string, piece: string | null) {
    if (!game || !myRole || game.status !== 'active') return;
    if (!isMyTurn()) return;

    if (!selected) {
      if (piece && ((myRole === 'white' && piece === piece.toUpperCase()) || (myRole === 'black' && piece === piece.toLowerCase()))) {
        setSelected(sqName);
      }
      return;
    }

    if (selected === sqName) { setSelected(null); return; }

    const movingPiece = pieceAt(selected);
    const isPawn = movingPiece && movingPiece.toUpperCase() === 'P';
    const destRank = sqName[1];
    if (isPawn && ((myRole === 'white' && destRank === '8') || (myRole === 'black' && destRank === '1'))) {
      setPromoChoice({ from: selected, to: sqName });
      setSelected(null);
      return;
    }

    postAction('move', { from: selected, to: sqName });
    setSelected(null);
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
    await postAction('move', { from: promoChoice.from, to: promoChoice.to, promotion: piece });
    setPromoChoice(null);
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

  const board = parseFen(game.fen);
  const ranks = myRole === 'black' ? [...Array(8).keys()] : [...Array(8).keys()].reverse();
  const filesOrdered = myRole === 'black' ? [...FILES].reverse() : FILES;
  const finished = game.status === 'finished';

  return (
    <div className="min-h-screen bg-muted text-foreground flex flex-col">
      <Seo title={`Партия — ${game.tournament_title}`} description="Шахматная партия" noindex />
      <Header />

      <main className="flex-1 py-6 px-4">
        <div className="container max-w-6xl mx-auto">
          <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
            <Link to={`/hall/${game.tournament_id}`} className="flex items-center gap-1 hover:text-secondary transition-colors">
              <Icon name="ArrowLeft" size={14} /> {game.tournament_title}
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            {/* Доска */}
            <div className="flex flex-col items-center gap-3">
              {/* Верхний игрок (чёрные, либо белые если перевёрнуто) */}
              <div className="w-full max-w-[560px] flex items-center justify-between px-1">
                <span className="font-medium text-gray-800 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-gray-800 inline-block" />
                  {myRole === 'black' ? game.white_fio : game.black_fio || '—'}
                </span>
                <span className={`font-mono text-lg px-3 py-1 rounded-lg ${game.turn === (myRole === 'black' ? 'white' : 'black') && !finished ? 'bg-primary text-primary-foreground' : 'bg-gray-100 text-gray-500'}`}>
                  {formatClock(myRole === 'black' ? liveWhiteMs : liveBlackMs)}
                </span>
              </div>

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
                    return (
                      <button
                        key={sqName}
                        onClick={() => handleSquareClick(sqName, piece)}
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
                        {piece && (
                          <span className={piece === piece.toUpperCase() ? 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]' : 'text-gray-900'}>
                            {UNICODE[piece]}
                          </span>
                        )}
                      </button>
                    );
                  })
                ))}
              </div>

              {/* Нижний игрок */}
              <div className="w-full max-w-[560px] flex items-center justify-between px-1">
                <span className="font-medium text-gray-800 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-white border border-gray-300 inline-block" />
                  {myRole === 'black' ? game.black_fio : game.white_fio || '—'}
                </span>
                <span className={`font-mono text-lg px-3 py-1 rounded-lg ${game.turn === (myRole === 'black' ? 'black' : 'white') && !finished ? 'bg-primary text-primary-foreground' : 'bg-gray-100 text-gray-500'}`}>
                  {formatClock(myRole === 'black' ? liveBlackMs : liveWhiteMs)}
                </span>
              </div>

              {moveError && (
                <div className="w-full max-w-[560px] bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2 flex items-center gap-2">
                  <Icon name="AlertCircle" size={14} /> {moveError}
                </div>
              )}

              {finished && (
                <div className="w-full max-w-[560px] bg-white border border-gray-100 rounded-xl px-5 py-4 text-center shadow-sm">
                  <p className="font-heading font-bold text-lg text-primary mb-1">
                    {RESULT_LABELS(game.result)}
                  </p>
                  <p className="text-sm text-gray-500">{RESULT_REASON_LABELS[game.result_reason || ''] || game.result_reason}</p>
                </div>
              )}

              {myRole && !finished && (
                <div className="w-full max-w-[560px] flex gap-2">
                  {game.draw_offered_by ? (
                    <>
                      <Button variant="outline" className="flex-1" onClick={() => postAction('accept_draw')}>
                        <Icon name="Check" size={15} className="mr-1" /> Принять ничью
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={() => postAction('decline_draw')}>
                        <Icon name="X" size={15} className="mr-1" /> Отклонить
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" className="flex-1" onClick={() => postAction('offer_draw')}>
                      <Icon name="Handshake" size={15} className="mr-1" /> Предложить ничью
                    </Button>
                  )}
                  <Button variant="outline" className="flex-1 text-red-500 border-red-200 hover:bg-red-50" onClick={() => { if (confirm('Сдать партию?')) postAction('resign'); }}>
                    <Icon name="Flag" size={15} className="mr-1" /> Сдаться
                  </Button>
                </div>
              )}

              {promoChoice && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
                  <div className="bg-white rounded-2xl p-5 shadow-xl">
                    <p className="text-sm font-medium text-gray-700 mb-3 text-center">Выберите фигуру для превращения</p>
                    <div className="flex gap-2">
                      {['Q', 'R', 'B', 'N'].map(p => (
                        <button key={p} onClick={() => handlePromotion(p)}
                          className="w-14 h-14 flex items-center justify-center text-4xl bg-muted rounded-xl hover:bg-secondary/20 transition-colors">
                          {UNICODE[myRole === 'white' ? p : p.toLowerCase()]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Правая колонка: ходы + чат */}
            <div className="flex flex-col gap-4">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Ходы партии</p>
                <p className="text-sm text-gray-700 font-mono leading-relaxed max-h-32 overflow-y-auto">
                  {game.pgn || 'Партия ещё не началась'}
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col h-[380px]">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Чат</p>
                <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
                  {chat.map((m, i) => (
                    <div key={i} className="text-sm">
                      <span className="font-medium text-primary">{m.fio}: </span>
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