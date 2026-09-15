import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '@/components/ui/icon';

interface MyApplication {
  id: number;
  tournament_id: number;
  tournament_title: string;
  fio: string;
  age: string;
  status: string;
  created_at: string;
  hall_open: boolean;
  tournament_status: string;
  description: string | null;
  date: string | null;
  location: string | null;
  age_category: string | null;
  price: number | null;
  time_control: string | null;
  time_msk: string | null;
  diploma_sample_url: string | null;
  regulation_url: string | null;
  announcement_url: string | null;
  hall_status: string;
  place: number | null;
}

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  new: { label: 'На рассмотрении', className: 'bg-blue-100 text-blue-700' },
  paid: { label: 'Подтверждено', className: 'bg-green-100 text-green-700' },
  pending_payment: { label: 'Ожидает оплаты', className: 'bg-orange-100 text-orange-700' },
  cancelled: { label: 'Отменено', className: 'bg-gray-100 text-gray-500' },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function ApplicationCard({ a }: { a: MyApplication }) {
  const [expanded, setExpanded] = useState(false);
  const s = STATUS_LABELS[a.status] || STATUS_LABELS.new;
  const hasDetails = !!(a.description || a.date || a.location || a.age_category || a.price || a.time_control || a.regulation_url || a.announcement_url || a.diploma_sample_url);
  const showPlace = a.hall_status === 'finished' && !!a.place;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => hasDetails && setExpanded(v => !v)}
        className={`w-full px-5 py-4 flex items-center justify-between gap-3 flex-wrap text-left ${hasDetails ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'}`}
      >
        <div className="flex items-center gap-3">
          {showPlace && (
            <span className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${a.place! <= 3 ? 'bg-secondary/10' : 'bg-muted/60 text-gray-500'}`}>
              {MEDALS[a.place!] || a.place}
            </span>
          )}
          <div>
            <p className="font-semibold text-primary">{a.tournament_title}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {showPlace ? `${a.place}-е место · ` : ''}Заявка от {formatDate(a.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${s.className}`}>{s.label}</span>
          {a.hall_status === 'finished' && (
            <Link
              to={`/hall/${a.tournament_id}`}
              onClick={e => e.stopPropagation()}
              className="text-xs px-2.5 py-1 rounded-full font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1"
            >
              <Icon name="Eye" size={12} /> Ход турнира
            </Link>
          )}
          {hasDetails && <Icon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={18} className="text-gray-400" />}
        </div>
      </button>

      {expanded && hasDetails && (
        <div className="px-5 pb-5 pt-1 border-t border-gray-100 flex flex-col gap-4">
          {a.description && (
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{a.description}</p>
          )}

          <div className="flex flex-col gap-1.5 text-sm text-gray-600">
            {a.date && (
              <span className="flex items-center gap-2">
                <Icon name="Calendar" size={14} className="text-secondary shrink-0" />
                {formatDate(a.date)}{a.time_msk && `, ${a.time_msk} МСК`}
              </span>
            )}
            {a.location && (
              <span className="flex items-center gap-2">
                <Icon name="MapPin" size={14} className="text-secondary shrink-0" /> {a.location}
              </span>
            )}
            {a.age_category && (
              <span className="flex items-center gap-2">
                <Icon name="Users" size={14} className="text-secondary shrink-0" /> {a.age_category}
              </span>
            )}
            {!!a.price && (
              <span className="flex items-center gap-2">
                <Icon name="CreditCard" size={14} className="text-secondary shrink-0" /> Взнос: {a.price.toLocaleString('ru')} ₽
              </span>
            )}
            {a.time_control && (
              <span className="flex items-center gap-2">
                <Icon name="Timer" size={14} className="text-secondary shrink-0" /> Контроль времени: {a.time_control}
              </span>
            )}
            {a.regulation_url && (
              <a href={a.regulation_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-medium text-primary hover:underline">
                <Icon name="ScrollText" size={14} className="shrink-0" /> Положение (PDF)
              </a>
            )}
          </div>

          {(a.announcement_url || a.diploma_sample_url) && (
            <div className="flex flex-col sm:flex-row gap-3">
              {a.announcement_url && (
                <a href={a.announcement_url} target="_blank" rel="noopener noreferrer" className="flex-1 flex flex-col gap-1.5 group">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Анонс</span>
                  <div className="min-h-24 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center p-1.5 group-hover:border-secondary/50 transition-colors">
                    <img src={a.announcement_url} alt={`Анонс турнира: ${a.tournament_title}`} className="max-w-full max-h-32 object-contain" />
                  </div>
                </a>
              )}
              {a.diploma_sample_url && (
                <a href={a.diploma_sample_url} target="_blank" rel="noopener noreferrer" className="flex-1 flex flex-col gap-1.5 group">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Образец диплома</span>
                  <div className="min-h-24 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center p-1.5 group-hover:border-secondary/50 transition-colors">
                    <img src={a.diploma_sample_url} alt={`Образец диплома турнира: ${a.tournament_title}`} className="max-w-full max-h-32 object-contain" />
                  </div>
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}