import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { getTypeMeta } from '@/pages/turnir/TournamentTypeBadge';
import func2url from '../../../backend/func2url.json';

const PUBLIC_URL = func2url['tournaments-public'];

interface Item {
  id: number;
  title: string;
  date: string | null;
  time_msk: string;
  price: number | null;
  status: string;
  tournament_type?: string;
  rating_type?: string;
  spots_left?: number | null;
}

function dayParts(date: string) {
  const d = new Date(date);
  return {
    day: d.getDate(),
    month: d.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', ''),
    weekday: d.toLocaleDateString('ru-RU', { weekday: 'long' }),
  };
}

export default function UpcomingTournaments() {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    fetch(PUBLIC_URL)
      .then(r => r.json())
      .then(d => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const list: Item[] = (d.tournaments || [])
          .filter((t: Item) => t.status !== 'cancelled' && t.date && new Date(t.date) >= today)
          .sort((a: Item, b: Item) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime())
          .slice(0, 5);
        setItems(list);
      })
      .catch(() => setItems([]));
  }, []);

  return (
    <section className="rounded-2xl bg-blue-50 border border-blue-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-blue-200 bg-blue-100/70">
        <h2 className="font-heading font-bold text-lg uppercase text-primary flex items-center gap-2">
          <Icon name="CalendarDays" size={20} className="text-secondary" /> Ближайшие турниры
        </h2>
        <Link to="/turnir" className="text-sm font-semibold text-secondary hover:underline flex items-center gap-1">
          Все турниры <Icon name="ArrowRight" size={14} />
        </Link>
      </div>
      {items === null ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Загрузка...</p>
      ) : items.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Новые турниры скоро появятся</p>
      ) : (
        <ul className="divide-y divide-blue-100 bg-white">
          {items.map(t => {
            const meta = getTypeMeta(t.tournament_type);
            const p = dayParts(t.date as string);
            const closed = t.status === 'closed';
            return (
              <li key={t.id}>
                <Link to="/turnir" className="flex items-center gap-4 px-5 py-3 hover:bg-muted/60 transition-colors">
                  <div className="w-14 shrink-0 text-center rounded-xl bg-secondary/10 py-1.5">
                    <p className="font-heading font-bold text-2xl leading-none text-secondary">{p.day}</p>
                    <p className="text-[11px] uppercase text-muted-foreground mt-0.5">{p.month}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-primary truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span className="capitalize">{p.weekday}{t.time_msk ? `, ${t.time_msk} МСК` : ''}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${meta.badge}`}>
                        <Icon name={meta.icon} size={11} /> {meta.label}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${t.rating_type === 'blitz' ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-sky-100 text-sky-800 border-sky-300'}`}>
                        <Icon name={t.rating_type === 'blitz' ? 'Zap' : 'Clock'} size={11} /> {t.rating_type === 'blitz' ? 'Блиц' : 'Рапид'}
                      </span>
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-heading font-bold text-primary">{t.price ? `${t.price} ₽` : 'Бесплатно'}</p>
                    <p className={`text-[11px] font-semibold ${closed ? 'text-orange-600' : 'text-emerald-600'}`}>
                      {closed ? 'Приём закрыт' : t.spots_left != null ? `Мест: ${t.spots_left}` : 'Приём открыт'}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
