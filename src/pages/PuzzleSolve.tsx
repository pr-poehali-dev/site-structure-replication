import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Header, Footer } from '@/components/Layout';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import Seo from '@/components/Seo';
import PuzzleBoard from '@/components/PuzzleBoard';
import { useAuth } from '@/contexts/AuthContext';
import { PUZZLES_URL, Puzzle, applyUci, DIFFICULTY_LABELS } from '@/lib/puzzles';

type Status = 'playing' | 'wrong' | 'solved';

export default function PuzzleSolve() {
  const { puzzleId } = useParams();
  const { token } = useAuth();
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [loading, setLoading] = useState(true);
  const [fen, setFen] = useState('');
  const [played, setPlayed] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>('playing');
  const [busy, setBusy] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [hintSquare, setHintSquare] = useState<string | null>(null);
  const [hintText, setHintText] = useState('');
  const [newlySolved, setNewlySolved] = useState(false);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['X-Auth-Token'] = token;

  function reset(p: Puzzle) {
    setFen(p.fen);
    setPlayed([]);
    setStatus('playing');
    setLastMove(null);
    setHintSquare(null);
    setHintText('');
  }

  useEffect(() => {
    setLoading(true);
    fetch(`${PUZZLES_URL}?id=${puzzleId}`, { headers: token ? { 'X-Auth-Token': token } : {} })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.puzzle) { setPuzzle(d.puzzle); reset(d.puzzle); } })
      .finally(() => setLoading(false));
  }, [puzzleId, token]);

  async function post(body: object) {
    const res = await fetch(PUZZLES_URL, { method: 'POST', headers, body: JSON.stringify({ _action: 'check', puzzle_id: puzzle!.id, played, ...body }) });
    return res.json();
  }

  async function handleMove(from: string, to: string, promotion?: string) {
    if (!puzzle || busy || status !== 'playing') return;
    const uci = from + to + (promotion || '');
    setBusy(true);
    setHintSquare(null);
    const data = await post({ move: uci });
    if (!data.correct) {
      setStatus('wrong');
      setBusy(false);
      setTimeout(() => setStatus(s => (s === 'wrong' ? 'playing' : s)), 1200);
      return;
    }
    let nextFen = applyUci(fen, data.move);
    let nextPlayed = [...played, data.move];
    setFen(nextFen);
    setLastMove({ from, to });
    if (data.solved) {
      setPlayed(nextPlayed);
      setStatus('solved');
      setNewlySolved(!!data.newly_solved);
      setBusy(false);
      return;
    }
    await new Promise(r => setTimeout(r, 450));
    nextFen = applyUci(nextFen, data.reply);
    nextPlayed = [...nextPlayed, data.reply];
    setFen(nextFen);
    setPlayed(nextPlayed);
    setLastMove({ from: data.reply.slice(0, 2), to: data.reply.slice(2, 4) });
    setBusy(false);
  }

  async function showHint() {
    const data = await post({ hint: true });
    if (data.hint_from) setHintSquare(data.hint_from);
    if (data.hint) setHintText(data.hint);
  }

  const turn = puzzle?.turn === 'b' ? 'чёрных' : 'белых';

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Seo title={puzzle ? `Задача: ${puzzle.title}` : 'Задача'} description="Решите шахматную задачу" />
      <Header />
      <main className="flex-1 container px-4 py-8 max-w-4xl mx-auto w-full">
        <Link to="/puzzles" className="text-sm text-muted-foreground hover:text-secondary flex items-center gap-1 mb-4">
          <Icon name="ArrowLeft" size={14} /> Все задачи
        </Link>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-10"><Icon name="Loader2" size={20} className="animate-spin" /> Загрузка...</div>
        ) : !puzzle ? (
          <p className="text-muted-foreground py-10">Задача не найдена</p>
        ) : (
          <div className="grid md:grid-cols-[1fr_280px] gap-6 items-start">
            <PuzzleBoard
              fen={fen}
              flipped={puzzle.turn === 'b'}
              disabled={busy || status === 'solved'}
              lastMove={lastMove}
              hintSquare={hintSquare}
              onMove={handleMove}
            />
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="font-heading font-bold text-2xl text-primary">{puzzle.title}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {DIFFICULTY_LABELS[puzzle.difficulty]}{puzzle.theme ? ` · ${puzzle.theme}` : ''}
                </p>
              </div>
              <div className={`rounded-xl px-4 py-3 text-sm font-medium border ${
                status === 'solved' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : status === 'wrong' ? 'bg-red-50 border-red-200 text-red-600'
                : 'bg-white border-border text-foreground/80'}`}>
                {status === 'solved' ? (newlySolved ? 'Задача решена! Засчитано в ваш рейтинг.' : 'Задача решена!')
                  : status === 'wrong' ? 'Неверно, попробуйте другой ход'
                  : `Ход ${turn}. Найдите лучшее продолжение`}
              </div>
              {status === 'solved' && !token && (
                <p className="text-xs text-muted-foreground">Войдите в аккаунт, чтобы решённые задачи сохранялись в рейтинге.</p>
              )}
              {hintText && <p className="text-sm text-foreground/70">Подсказка: {hintText}</p>}
              <div className="flex flex-wrap gap-2">
                {puzzle.has_hint && status !== 'solved' && (
                  <Button variant="outline" onClick={showHint} disabled={busy}><Icon name="Lightbulb" size={15} className="mr-2" />Подсказка</Button>
                )}
                <Button variant="outline" onClick={() => reset(puzzle)}><Icon name="RotateCcw" size={15} className="mr-2" />Сначала</Button>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
