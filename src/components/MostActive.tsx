import { useEffect, useState, type ReactNode } from 'react';
import Icon from '@/components/ui/icon';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PlayerProfileModal from '@/components/PlayerProfileModal';
import func2url from '../../backend/func2url.json';

const URL = func2url['activity-rating'];

type Period = 'month' | 'all';

interface Player {
  user_id: number;
  points: number;
  tournaments: number;
  place: number;
  last_name: string;
  first_name: string;
  avatar_url: string | null;
}

interface Theme {
  title: string;
  icon: string;
  header: string;
  headerText: string;
  accent: string;
  soft: string;
  border: string;
}

const THEMES: Record<Period, Theme> = {
  month: {
    title: 'Самые активные участники месяца',
    icon: 'Flame',
    header: '#FF6B4A',
    headerText: '#ffffff',
    accent: '#E8452A',
    soft: '#FFF1EC',
    border: '#FFC9BB',
  },
  all: {
    title: 'Самые активные участники за всё время',
    icon: 'Trophy',
    header: '#7C4DFF',
    headerText: '#ffffff',
    accent: '#5B2FE0',
    soft: '#F1ECFF',
    border: '#CDBBFF',
  },
};

function Row({ p, theme, onOpen }: { p: Player; theme: Theme; onOpen: (id: number) => void }) {
  return (
    <button type="button" onClick={() => onOpen(p.user_id)} className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 hover:bg-black/5 transition-colors">
      <span
        className="w-6 h-6 rounded-full grid place-items-center text-xs font-bold shrink-0"
        style={{ background: p.place <= 3 ? theme.header : theme.border, color: p.place <= 3 ? theme.headerText : '#141414' }}
      >
        {p.place}
      </span>
      <Avatar className="w-7 h-7 shrink-0">
        <AvatarImage src={p.avatar_url || undefined} alt={p.first_name} />
        <AvatarFallback className="text-[10px] font-bold" style={{ background: theme.border, color: '#141414' }}>
          {(p.last_name[0] || '') + (p.first_name[0] || '')}
        </AvatarFallback>
      </Avatar>
      <p className="min-w-0 flex-1 font-semibold text-xs sm:text-sm leading-tight text-[#141414] break-words">{p.last_name} {p.first_name}</p>
      <span className="shrink-0 font-heading font-bold text-sm" style={{ color: theme.accent }}>
        {p.points} <span className="text-[10px] font-medium text-[#666666]">оч.</span>
      </span>
    </button>
  );
}

interface BoardProps {
  period: Period;
  players: Player[];
  total: number;
  onShowAll: (period: Period) => void;
  onOpenProfile: (id: number) => void;
}

function Board({ period, players, total, onShowAll, onOpenProfile }: BoardProps) {
  const theme = THEMES[period];
  return (
    <div className="rounded-xl overflow-hidden shadow-md border flex flex-col" style={{ background: theme.soft, borderColor: theme.border }}>
      <div className="px-3 py-2.5" style={{ background: theme.header, color: theme.headerText }}>
        <h2 className="font-heading font-bold text-sm leading-tight uppercase flex items-start gap-2">
          <Icon name={theme.icon} size={16} className="shrink-0 mt-0.5" /> {theme.title}
        </h2>
      </div>
      {players.length === 0 ? (
        <p className="px-4 py-4 text-sm text-[#666666]">Пока нет завершённых турниров</p>
      ) : (
        <div className="py-1 flex-1">
          {players.map(p => <Row key={p.user_id} p={p} theme={theme} onOpen={onOpenProfile} />)}
        </div>
      )}
      {total > 3 && (
        <button
          type="button"
          onClick={() => onShowAll(period)}
          className="px-3 py-2 text-xs font-semibold border-t text-left hover:bg-black/5 transition-colors"
          style={{ color: theme.accent, borderColor: theme.border }}
        >
          Показать всех ({total})
        </button>
      )}
    </div>
  );
}

export default function MostActive({ fallback = null }: { fallback?: ReactNode }) {
  const [data, setData] = useState<Record<Period, { players: Player[]; total: number }> | null>(null);
  const [dialog, setDialog] = useState<Period | null>(null);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [full, setFull] = useState<Partial<Record<Period, Player[]>>>({});

  useEffect(() => {
    Promise.all((['month', 'all'] as Period[]).map(p => fetch(`${URL}?limit=3&period=${p}`).then(r => r.json())))
      .then(([m, a]) => setData({
        month: { players: m.players || [], total: m.total || 0 },
        all: { players: a.players || [], total: a.total || 0 },
      }))
      .catch(() => setData(null));
  }, []);

  async function showAll(period: Period) {
    setDialog(period);
    if (full[period]) return;
    const d = await fetch(`${URL}?all=1&period=${period}`).then(r => r.json());
    setFull(prev => ({ ...prev, [period]: d.players || [] }));
  }

  if (!data || (data.all.players.length === 0 && data.month.players.length === 0)) return <>{fallback}</>;

  const theme = dialog ? THEMES[dialog] : null;

  return (
    <div className="animate-fade-in flex flex-col gap-3">
      <h1 className="sr-only">Мир шахмат — центр поддержки детского шахматного спорта</h1>
      <div className="grid grid-cols-2 gap-3 items-stretch">
        <Board period="month" players={data.month.players} total={data.month.total} onShowAll={showAll} onOpenProfile={setProfileId} />
        <Board period="all" players={data.all.players} total={data.all.total} onShowAll={showAll} onOpenProfile={setProfileId} />
      </div>
      <p className="text-xs text-[#666666] px-1">
        Очки за турниры: разминочный — 1, тренировочный — 2, квалификационный — 3
      </p>

      <Dialog open={!!dialog} onOpenChange={o => !o && setDialog(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          {theme && dialog && (
            <>
              <DialogHeader className="px-5 py-4" style={{ background: theme.header }}>
                <DialogTitle className="font-heading" style={{ color: theme.headerText }}>{theme.title}</DialogTitle>
              </DialogHeader>
              <div className="overflow-y-auto py-1" style={{ background: theme.soft }}>
                {!full[dialog] && <p className="p-6 text-center text-sm text-[#666666]">Загрузка...</p>}
                {(full[dialog] || []).map(p => <Row key={p.user_id} p={p} theme={theme} onOpen={setProfileId} />)}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <PlayerProfileModal userId={profileId} onClose={() => setProfileId(null)} />
    </div>
  );
}
