import { Link } from 'react-router-dom';
import Icon from '@/components/ui/icon';

const LINKS = [
  { to: '/turnir', icon: 'Swords', label: 'Турниры', hint: 'Запись онлайн', color: 'bg-blue-100 text-blue-600' },
  { to: '/olimpiady', icon: 'Medal', label: 'Олимпиады', hint: 'Дебют, Эврика, Эрудит', color: 'bg-emerald-100 text-emerald-600' },
  { to: '/puzzles', icon: 'Puzzle', label: 'Задачи', hint: 'Решай и расти', color: 'bg-violet-100 text-violet-600' },
  { to: '/result', icon: 'ListChecks', label: 'Результаты', hint: 'Протоколы и дипломы', color: 'bg-orange-100 text-orange-600' },
  { to: '/kubki', icon: 'Award', label: 'Награды', hint: 'Кубки и медали', color: 'bg-rose-100 text-rose-600' },
  { to: '/cabinet', icon: 'UserRound', label: 'Кабинет', hint: 'Баланс и заявки', color: 'bg-sky-100 text-sky-600' },
];

export default function QuickLinks() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {LINKS.map(l => (
        <Link
          key={l.to}
          to={l.to}
          className="group flex items-center gap-3 rounded-2xl bg-white border border-border p-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
        >
          <span className={`grid place-items-center w-11 h-11 rounded-xl shrink-0 ${l.color}`}>
            <Icon name={l.icon} size={22} />
          </span>
          <span className="min-w-0">
            <span className="block font-heading font-bold text-sm uppercase text-primary leading-tight">{l.label}</span>
            <span className="block text-[11px] text-muted-foreground leading-tight truncate">{l.hint}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
