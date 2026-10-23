import { useEffect, useState } from 'react';
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
    <Link to={`/player/${p.user_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
      <span className="w-8 text-center font-heading font-bold text-primary shrink-0">{MEDALS[p.place] || p.place}</span>
      <Avatar className="w-9 h-9 shrink-0">
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

export default function MostActive() {
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

  if (loaded && top.length === 0 && period === 'all') return null;
  if (!loaded) return null;

  return (
    <section className="bg-white">
      <div className="container px-4 py-10">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <h2 className="font-heading font-bold text-2xl md:text-3xl uppercase text-primary flex items-center justify-center gap-2">
              <Icon name="Flame" size={26} className="text-orange-500" /> Самые активные
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              Очки за участие в турнирах: разминочный — 1, тренировочный — 2, квалификационный — 3
            </p>
          </div>
          <div className="flex justify-center mb-4">
            <div className="inline-flex rounded-full bg-muted p-1 text-sm font-semibold">
              {([['all', 'За всё время'], ['month', 'За этот месяц']] as [Period, string][]).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPeriod(key)}
                  className={`px-4 py-1.5 rounded-full transition-colors ${period === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-primary'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
            {top.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">В этом месяце ещё нет завершённых турниров</p>}
            {top.map(p => <Row key={p.user_id} p={p} />)}
          </div>
          {total > top.length && (
            <div className="text-center mt-5">
              <Button variant="outline" onClick={showAll} className="border-primary/30 text-primary">
                Показать всех ({total})
              </Button>
            </div>
          )}
        </div>
      </div>

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
    </section>
  );
}
