import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header, Footer } from '@/components/Layout';
import Icon from '@/components/ui/icon';
import Seo from '@/components/Seo';
import MiniChessBoard from '@/components/MiniChessBoard';
import { useAuth } from '@/contexts/AuthContext';
import { PUZZLES_URL, Puzzle, Leader, DIFFICULTY_LABELS } from '@/lib/puzzles';

export default function Puzzles() {
  const { token } = useAuth();
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState(0);

  useEffect(() => {
    fetch(PUZZLES_URL, { headers: token ? { 'X-Auth-Token': token } : {} })
      .then(r => r.json())
      .then(d => setPuzzles(d.puzzles || []))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    fetch(`${PUZZLES_URL}?leaderboard=1`).then(r => r.json()).then(d => setLeaders(d.leaders || [])).catch(() => {});
  }, []);

  const shown = puzzles.filter(p => !level || p.difficulty === level);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Seo title="Шахматные задачи" description="Решайте шахматные задачи и соревнуйтесь с другими участниками" />
      <Header />
      <main className="flex-1 container px-4 py-10 max-w-5xl mx-auto w-full">
        <h1 className="font-heading font-bold text-4xl text-primary mb-2">Задачи</h1>
        <p className="text-muted-foreground mb-6">Найдите лучший ход. Войдите в аккаунт, чтобы решённые задачи сохранялись и попадали в рейтинг.</p>

        <div className="grid lg:grid-cols-[1fr_300px] gap-8 items-start">
          <div>
            <div className="flex flex-wrap gap-2 mb-4">
              {[0, 1, 2, 3, 4, 5].map(l => (
                <button key={l} onClick={() => setLevel(l)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${level === l ? 'bg-secondary text-secondary-foreground border-secondary' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                  {l === 0 ? 'Все' : DIFFICULTY_LABELS[l]}
                </button>
              ))}
            </div>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-6"><Icon name="Loader2" size={20} className="animate-spin" /> Загрузка...</div>
            ) : shown.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground text-center">
                <Icon name="Puzzle" size={40} className="opacity-25" />
                <p>Задач пока нет</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {shown.map(p => (
                  <Link key={p.id} to={`/puzzles/${p.id}`}
                    className="flex gap-4 p-4 rounded-xl border border-border bg-white hover:border-secondary hover:shadow-md transition-all">
                    <MiniChessBoard fen={p.fen} size={110} />
                    <div className="flex flex-col gap-1 min-w-0">
                      <p className="font-semibold text-primary truncate">{p.title}</p>
                      <p className="text-xs text-muted-foreground">{DIFFICULTY_LABELS[p.difficulty]}</p>
                      <p className="text-xs text-muted-foreground">{p.turn === 'w' ? 'Ход белых' : 'Ход чёрных'}</p>
                      {p.solved && <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium mt-auto"><Icon name="CheckCircle2" size={14} />Решена</span>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <aside className="rounded-xl border border-border bg-white p-4">
            <h2 className="font-heading font-bold text-lg text-primary mb-3 flex items-center gap-2"><Icon name="Trophy" size={18} className="text-secondary" />Рейтинг решателей</h2>
            {leaders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Пока никто не решил ни одной задачи</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {leaders.map((l, i) => (
                  <li key={l.user_id} className="flex items-center gap-2 text-sm">
                    <span className="w-6 text-muted-foreground">{i + 1}</span>
                    <Link to={`/player/${l.user_id}`} className="flex-1 truncate hover:text-secondary">{l.fio || 'Участник'}</Link>
                    <span className="font-semibold">{l.solved}</span>
                  </li>
                ))}
              </ol>
            )}
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
