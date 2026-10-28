import { useEffect, useState, type ReactNode } from 'react';
import Icon from '@/components/ui/icon';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PlayerProfileModal from '@/components/PlayerProfileModal';
import func2url from '../../backend/func2url.json';

const URL = func2url['activity-rating'];

export type BoardKey = 'month' | 'all' | 'blitz' | 'rapid';

interface Theme {
  title: string;
  icon: string;
  header: string;
  headerText: string;
  accent: string;
  soft: string;
  border: string;
  query: string;
  unit: string;
}

interface Player {
  user_id: number;
  points: number;
  tournaments: number;
  place: number;
  last_name: string;
  first_name: string;
  avatar_url: string | null;
}

export const THEMES: Record<BoardKey, Theme> = {
  month: {
    title: 'Самые активные участники месяца', icon: 'Flame', query: 'period=month', unit: 'оч.',
    header: '#2DB86B', headerText: '#ffffff', accent: '#1E9A55', soft: '#EAF8F0', border: '#B8E6CD',
  },
  all: {
    title: 'Самые активные участники за всё время', icon: 'Trophy', query: 'period=all', unit: 'оч.',
    header: '#3D7BF7', headerText: '#ffffff', accent: '#2A5FD6', soft: '#EAF1FF', border: '#BBD2FF',
  },
  blitz: {
    title: 'Лидеры рейтинга МШ · Блиц', icon: 'Zap', query: 'rating=blitz', unit: '',
    header: '#F59E0B', headerText: '#141414', accent: '#B45309', soft: '#FFF6E0', border: '#FFDE99',
  },
  rapid: {
    title: 'Лидеры рейтинга МШ · Рапид', icon: 'Timer', query: 'rating=rapid', unit: '',
    header: '#8B5CF6', headerText: '#ffffff', accent: '#6D3FE0', soft: '#F2ECFF', border: '#D3C3FF',
  },
};

function Row({ p, theme, onOpen, top = false }: { p: Player; theme: Theme; onOpen: (id: number) => void; top?: boolean }) {
  return (
    <button type="button" onClick={() => onOpen(p.user_id)} className={`w-full text-left flex items-center gap-2 px-2.5 hover:bg-black/5 transition-colors ${top ? 'py-2 bg-white/70 border-l-4' : 'py-1 opacity-80'}`} style={top ? { borderLeftColor: theme.header } : undefined}>
      <span
        className="w-6 h-6 rounded-full grid place-items-center text-xs font-bold shrink-0"
        style={{ background: top ? theme.header : theme.border, color: top ? theme.headerText : '#141414' }}
      >
        {p.place}
      </span>
      <Avatar className={`shrink-0 ${top ? 'w-8 h-8' : 'w-6 h-6'}`}>
        <AvatarImage src={p.avatar_url || undefined} alt={p.first_name} />
        <AvatarFallback className="text-[10px] font-bold" style={{ background: theme.border, color: '#141414' }}>
          {(p.last_name[0] || '') + (p.first_name[0] || '')}
        </AvatarFallback>
      </Avatar>
      <p className={`min-w-0 flex-1 ${top ? 'font-bold' : 'font-medium'} text-xs leading-tight text-[#141414] break-words`}>{p.last_name} {p.first_name}</p>
      <span className="shrink-0 font-heading font-bold text-sm" style={{ color: theme.accent }}>
        {p.points}{theme.unit && <span className="text-[10px] font-medium text-[#666666]"> {theme.unit}</span>}
      </span>
    </button>
  );
}

interface BoardProps {
  period: BoardKey;
  players: Player[];
  total: number;
  onShowAll: (period: BoardKey) => void;
  onOpenProfile: (id: number) => void;
}

function Board({ period, players, total, onShowAll, onOpenProfile }: BoardProps) {
  const theme = THEMES[period];
  return (
    <div className="rounded-xl overflow-hidden shadow-md border flex flex-col" style={{ background: theme.soft, borderColor: theme.border }}>
      <div className="px-3 py-2" style={{ background: theme.header, color: theme.headerText }}>
        <h2 className="font-heading font-bold text-xs leading-tight uppercase flex items-start gap-2">
          <Icon name={theme.icon} size={16} className="shrink-0 mt-0.5" /> {theme.title}
        </h2>
      </div>
      {players.length === 0 ? (
        <p className="px-4 py-4 text-sm text-[#666666]">Пока нет завершённых турниров</p>
      ) : (
        <div className="py-1 flex-1">
          {players.map((p, i) => <Row key={p.user_id} p={p} theme={theme} onOpen={onOpenProfile} top={i < 3} />)}
        </div>
      )}
      {total > 5 && (
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

interface Props {
  kinds: [BoardKey, BoardKey];
  note?: string;
  fallback?: ReactNode;
  heading?: string;
}

export default function MostActive({ kinds, note, fallback = null, heading }: Props) {
  const [data, setData] = useState<Record<string, { players: Player[]; total: number }> | null>(null);
  const [dialog, setDialog] = useState<BoardKey | null>(null);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [full, setFull] = useState<Partial<Record<BoardKey, Player[]>>>({});

  useEffect(() => {
    Promise.all(kinds.map(k => fetch(`${URL}?limit=5&${THEMES[k].query}`).then(r => r.json())))
      .then(res => {
        const next: Record<string, { players: Player[]; total: number }> = {};
        kinds.forEach((k, i) => { next[k] = { players: res[i].players || [], total: res[i].total || 0 }; });
        setData(next);
      })
      .catch(() => setData(null));
  }, [kinds[0], kinds[1]]);

  async function showAll(key: BoardKey) {
    setDialog(key);
    if (full[key]) return;
    const d = await fetch(`${URL}?all=1&${THEMES[key].query}`).then(r => r.json());
    setFull(prev => ({ ...prev, [key]: d.players || [] }));
  }

  if (!data || kinds.every(k => data[k].players.length === 0)) return <>{fallback}</>;

  const theme = dialog ? THEMES[dialog] : null;

  return (
    <div className="animate-fade-in flex flex-col gap-3">
      {heading && <h1 className="sr-only">{heading}</h1>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 items-stretch">
        {kinds.map(k => (
          <Board key={k} period={k} players={data[k].players} total={data[k].total} onShowAll={showAll} onOpenProfile={setProfileId} />
        ))}
      </div>
      {note && <p className="text-[11px] text-white/70 px-1">{note}</p>}

      <Dialog open={!!dialog} onOpenChange={o => !o && setDialog(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          {theme && dialog && (
            <>
              <DialogHeader className="px-5 py-4" style={{ background: theme.header }}>
                <DialogTitle className="font-heading" style={{ color: theme.headerText }}>{theme.title}</DialogTitle>
              </DialogHeader>
              <div className="overflow-y-auto py-1" style={{ background: theme.soft }}>
                {!full[dialog] && <p className="p-6 text-center text-sm text-[#666666]">Загрузка...</p>}
                {(full[dialog] || []).map((p, i) => <Row key={p.user_id} p={p} theme={theme} onOpen={setProfileId} top={i < 3} />)}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <PlayerProfileModal userId={profileId} onClose={() => setProfileId(null)} />
    </div>
  );
}
