import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import func2url from '../../backend/func2url.json';

const URL = func2url['activity-rating'];
const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

interface Player {
  user_id: number;
  points: number;
  tournaments: number;
  place: number;
  last_name: string;
  first_name: string;
  avatar_url: string | null;
}

function Row({ p }: { p: Player }) {
  return (
    <Link to={`/player/${p.user_id}`} className="flex items-center gap-2.5 px-2 py-2 hover:bg-muted/40 transition-colors rounded-lg">
      <span className="w-7 text-center font-heading font-bold text-primary shrink-0">{MEDALS[p.place] || p.place}</span>
      <Avatar className="w-8 h-8 shrink-0">
        <AvatarImage src={p.avatar_url || undefined} alt={p.first_name} />
        <AvatarFallback className="bg-secondary/20 text-primary text-xs font-bold">
          {(p.last_name[0] || '') + (p.first_name[0] || '')}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-primary text-sm truncate">{p.last_name} {p.first_name}</p>
        <p className="text-xs text-muted-foreground">Турниров: {p.tournaments}</p>
      </div>
      <span className="shrink-0 font-heading font-bold text-secondary">{p.points} <span className="text-xs font-medium text-muted-foreground">оч.</span></span>
    </Link>
  );
}

type Period = 'all' | 'month';

export default function MostActive({ fallback = null }: { fallback?: ReactNode }) {
  const [top, setTop] = useState<Player[]>([]);
  const [total, setTotal] = useState(0);
  const [all, setAll] = useState<Player[] | null>(null);
  const [open, setOpen] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [period, setPeriod] = useState<Period>('all');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setAll(null);
    fetch(`${URL}?limit=10&period=${period}`)
      .then(r => r.json())
      .then(d => { setTop(d.players || []); setTotal(d.total || 0); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [period]);

  async function showAll() {
    setOpen(true);
    if (all) return;
    setLoadingAll(true);
    try {
      const d = await fetch(`${URL}?all=1&period=${period}`).then(r => r.json());
      setAll(d.players || []);
    } finally {
      setLoadingAll(false);
    }
  }

  if (!loaded || (top.length === 0 && period === 'all')) return <>{fallback}</>;

  const half = Math.ceil(top.length / 2);
  const columns = [top.slice(0, half), top.slice(half)];

  return (
    <div className="animate-fade-in rounded-2xl border border-border bg-white/90 backdrop-blur shadow-md p-4 md:p-5">
      <h1 className="sr-only">Мир шахмат — центр поддержки детского шахматного спорта</h1>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="font-heading font-bold text-xl md:text-2xl uppercase text-primary flex items-center gap-2">
          <Icon name="Flame" size={22} className="text-orange-500" /> Самые активные
        </h2>
        <div className="inline-flex rounded-full bg-muted p-1 text-xs font-semibold">
          {([['all', 'За всё время'], ['month', 'За месяц']] as [Period, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              className={`px-3 py-1 rounded-full transition-colors ${period === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-primary'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Очки за турниры: разминочный — 1, тренировочный — 2, квалификационный — 3
      </p>
      {top.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">В этом месяце ещё нет завершённых турниров</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-x-4">
          {columns.map((col, i) => (
            <div key={i} className="divide-y divide-border">
              {col.map(p => <Row key={p.user_id} p={p} />)}
            </div>
          ))}
        </div>
      )}
      {total > top.length && (
        <div className="text-center mt-3">
          <Button variant="outline" size="sm" onClick={showAll} className="border-primary/30 text-primary">
            Показать всех ({total})
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 py-4 border-b border-border">
            <DialogTitle className="font-heading text-primary">Рейтинг активности · {period === 'month' ? 'этот месяц' : 'всё время'}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto divide-y divide-border">
            {loadingAll && <p className="p-6 text-center text-sm text-muted-foreground">Загрузка...</p>}
            {(all || []).map(p => <Row key={p.user_id} p={p} />)}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
