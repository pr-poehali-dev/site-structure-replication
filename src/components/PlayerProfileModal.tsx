import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import Icon from '@/components/ui/icon';
import { shortFio } from '@/lib/fio';
import { calcAge, formatDate, initials } from '@/pages/cabinet/utils';
import func2url from '../../backend/func2url.json';

const PROFILE_URL = func2url['player-profile'];

interface PublicProfile {
  id: number;
  last_name: string;
  first_name: string;
  birth_date: string | null;
  fsr_id: string | null;
  coach_fio: string | null;
  institution: string | null;
  country_city: string | null;
  created_at: string;
  avatar_url: string | null;
  rating_blitz: number | null;
  rating_rapid: number | null;
  fsr_rating_blitz: number | null;
  fsr_rating_rapid: number | null;
}

interface TournamentItem {
  tournament_id: number;
  title: string;
  hall_status: string;
  points: number;
  place: number | null;
  rating_type: 'blitz' | 'rapid';
}

interface GameItem {
  id: number;
  round_number: number;
  my_color: 'white' | 'black';
  opponent_fio: string | null;
  outcome: 'win' | 'loss' | 'draw';
  tournament_title: string;
}

interface Props {
  userId: number | null;
  onClose: () => void;
}

const TYPE_LABELS: Record<string, string> = { blitz: 'Блиц', rapid: 'Рапид' };

const Stat = ({ label, value, accent }: { label: string; value: number | null; accent?: boolean }) => (
  <div className={`flex-1 rounded-lg px-2 py-2 text-center ${accent ? 'bg-secondary/10' : 'bg-muted/50'}`}>
    <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
    <p className="font-heading font-bold text-sm text-primary">{value ?? '—'}</p>
  </div>
);

export default function PlayerProfileModal({ userId, onClose }: Props) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [tournaments, setTournaments] = useState<TournamentItem[]>([]);
  const [games, setGames] = useState<GameItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (userId === null) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setProfile(null);
    fetch(`${PROFILE_URL}?user_id=${userId}`)
      .then(async r => {
        const data = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          setError(data.error || 'Игрок не найден');
          return;
        }
        setProfile(data.profile);
        setTournaments(data.tournaments || []);
        setGames((data.games || []).slice(0, 5));
      })
      .catch(() => !cancelled && setError('Не удалось загрузить профиль'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const age = profile ? calcAge(profile.birth_date) : null;
  const fullName = profile ? [profile.last_name, profile.first_name].filter(Boolean).join(' ') : '';

  const rows: [string, string][] = profile
    ? [
        ['ID ФШР', profile.fsr_id || '—'],
        ['Возраст', age !== null ? `${age} лет` : '—'],
        ['ФИО тренера', profile.coach_fio || '—'],
        ['Учреждение', profile.institution || '—'],
        ['Страна / Город', profile.country_city || '—'],
        ['На платформе с', formatDate(profile.created_at)],
      ]
    : [];

  return (
    <Dialog open={userId !== null} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Профиль игрока</DialogTitle>
          <DialogDescription className="sr-only">Информация об игроке</DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex justify-center py-10">
            <Icon name="Loader2" size={28} className="animate-spin text-secondary" />
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-8">
            <Icon name="UserX" size={36} className="text-secondary mx-auto mb-3" />
            <p className="text-sm text-gray-500">{error}</p>
          </div>
        )}

        {!loading && !error && profile && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <Avatar className="w-14 h-14 border-2 border-secondary/30">
                <AvatarImage src={profile.avatar_url || undefined} alt={profile.first_name} />
                <AvatarFallback className="bg-gradient-to-br from-secondary/70 to-secondary text-white font-heading font-bold">
                  {initials(profile.last_name, profile.first_name)}
                </AvatarFallback>
              </Avatar>
              <p className="font-heading font-bold text-lg text-primary leading-tight">{fullName}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Рейтинг МШ</p>
                <div className="flex gap-2">
                  <Stat label="Блиц" value={profile.rating_blitz} />
                  <Stat label="Рапид" value={profile.rating_rapid} />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Рейтинг ФШР</p>
                <div className="flex gap-2">
                  <Stat label="Блиц" value={profile.fsr_rating_blitz} accent />
                  <Stat label="Рапид" value={profile.fsr_rating_rapid} accent />
                </div>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              {rows.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10px] text-gray-400 uppercase tracking-wide">{k}</dt>
                  <dd className="font-medium text-gray-800 mt-0.5">{v}</dd>
                </div>
              ))}
            </dl>

            {tournaments.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Турниры</p>
                <div className="flex flex-col divide-y divide-gray-50 border border-gray-100 rounded-lg">
                  {tournaments.slice(0, 5).map(t => (
                    <div key={t.tournament_id} className="px-3 py-2 flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 truncate">{t.title}</p>
                        <p className="text-xs text-gray-400">{TYPE_LABELS[t.rating_type] || t.rating_type}</p>
                      </div>
                      <div className="shrink-0 text-xs text-gray-500">
                        {t.place ? (t.place <= 3 ? ['🥇', '🥈', '🥉'][t.place - 1] : `${t.place} место`) : ''} · {t.points} очк.
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {games.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Последние партии</p>
                <div className="flex flex-col divide-y divide-gray-50 border border-gray-100 rounded-lg">
                  {games.map(g => (
                    <div key={g.id} className="px-3 py-2 flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-gray-800">
                        {g.my_color === 'white' ? 'Белыми' : 'Чёрными'} против {shortFio(g.opponent_fio) || 'соперника'}
                      </span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          g.outcome === 'win'
                            ? 'bg-green-100 text-green-700'
                            : g.outcome === 'loss'
                            ? 'bg-red-100 text-red-600'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {g.outcome === 'win' ? 'Победа' : g.outcome === 'loss' ? 'Поражение' : 'Ничья'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Link to={`/player/${profile.id}`} className="text-sm font-semibold text-secondary hover:underline self-start">
              Открыть полный профиль →
            </Link>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
