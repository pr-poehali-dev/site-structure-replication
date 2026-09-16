import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Header, Footer } from '@/components/Layout';
import Seo from '@/components/Seo';
import Icon from '@/components/ui/icon';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import MiniChessBoard from '@/components/MiniChessBoard';
import { shortFio } from '@/lib/fio';
import { calcAge, formatDate, formatDateTime, initials } from '@/pages/cabinet/utils';
import func2url from '../../backend/func2url.json';

const PROFILE_URL = func2url['player-profile'];

interface PublicProfile {
  id: number;
  last_name: string;
  first_name: string;
  middle_name: string | null;
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
  tournament_id: number;
  tournament_title: string;
  round_number: number;
  rating_type: 'blitz' | 'rapid';
  my_color: 'white' | 'black';
  opponent_fio: string | null;
  result: string | null;
  result_reason: string | null;
  outcome: 'win' | 'loss' | 'draw';
  fen: string;
  moves_count: number;
  finished_at: string | null;
}

const RATING_TYPE_LABELS: Record<string, string> = { blitz: 'Блиц', rapid: 'Рапид' };

const REASON_LABELS: Record<string, string> = {
  checkmate: 'Мат',
  stalemate: 'Пат',
  draw_agreed: 'Ничья по соглашению',
  resignation: 'Сдача',
  timeout: 'Поражение по времени',
  insufficient_material: 'Недостаточно материала',
  first_move_timeout: 'Не сделан первый ход',
};

function resultLabel(g: GameItem): string {
  const reason = g.result_reason ? REASON_LABELS[g.result_reason] || g.result_reason : '';
  if (g.result === '1/2-1/2') return reason || 'Ничья';
  const winnerColor = g.result === '1-0' ? 'Белые' : 'Чёрные';
  return reason ? `${reason} · Победа: ${winnerColor.toLowerCase()}` : `Победа: ${winnerColor.toLowerCase()}`;
}

export default function PlayerProfile() {
  const { userId } = useParams();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [tournaments, setTournaments] = useState<TournamentItem[]>([]);
  const [games, setGames] = useState<GameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch(`${PROFILE_URL}?user_id=${userId}`)
      .then(async r => {
        const data = await r.json();
        if (!r.ok) { setFetchError(data.error || 'Игрок не найден'); return; }
        setProfile(data.profile);
        setTournaments(data.tournaments || []);
        setGames(data.games || []);
        setFetchError('');
      })
      .catch(() => setFetchError('Не удалось загрузить профиль'))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Icon name="Loader2" size={32} className="animate-spin text-secondary" />
      </div>
    );
  }

  if (fetchError || !profile) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Seo title="Профиль игрока" description="Профиль участника турниров" noindex />
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
            <Icon name="UserX" size={40} className="text-secondary mx-auto mb-4" />
            <p className="text-gray-500 text-sm mb-6">{fetchError || 'Игрок не найден'}</p>
            <Link to="/turnir" className="text-secondary font-semibold hover:underline">К турнирам →</Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const age = calcAge(profile.birth_date);
  const fullName = [profile.last_name, profile.first_name].filter(Boolean).join(' ');

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Seo title={fullName || 'Профиль игрока'} description={`Профиль участника турниров: ${fullName}`} noindex />
      <Header />

      <section className="bg-gradient-to-br from-secondary/25 via-secondary/10 to-white text-primary relative overflow-hidden">
        <div className="absolute inset-0 chess-grid opacity-10" />
        <div className="container relative px-4 py-8 max-w-6xl mx-auto">
          <h1 className="font-heading font-semibold text-2xl md:text-3xl">Профиль игрока</h1>
        </div>
      </section>

      <section className="container px-4 py-8 mx-auto max-w-6xl">
        <div className="grid lg:grid-cols-[260px_1fr] gap-6 items-start">
          <div className="flex flex-col gap-4 lg:sticky lg:top-20">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center text-center gap-3">
              <Avatar className="w-16 h-16 border-2 border-secondary/30">
                <AvatarImage src={profile.avatar_url || undefined} alt={profile.first_name} />
                <AvatarFallback className="bg-gradient-to-br from-secondary/70 to-secondary text-white font-heading font-bold text-lg">
                  {initials(profile.last_name, profile.first_name)}
                </AvatarFallback>
              </Avatar>

              <div>
                <p className="font-heading font-bold text-base text-primary leading-tight">{profile.last_name} {profile.first_name}</p>
                {age !== null && <p className="text-xs text-gray-400">{age} лет</p>}
              </div>

              <div className="w-full flex flex-col gap-2">
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 text-left">Рейтинг МШ (Мир шахмат)</p>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-muted/50 rounded-lg px-2 py-2 text-center">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Блиц</p>
                      <p className="font-heading font-bold text-sm text-primary">{profile.rating_blitz ?? '—'}</p>
                    </div>
                    <div className="flex-1 bg-muted/50 rounded-lg px-2 py-2 text-center">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Рапид</p>
                      <p className="font-heading font-bold text-sm text-primary">{profile.rating_rapid ?? '—'}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 text-left">Рейтинг ФШР</p>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-secondary/10 rounded-lg px-2 py-2 text-center">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Блиц</p>
                      <p className="font-heading font-bold text-sm text-primary">{profile.fsr_rating_blitz ?? '—'}</p>
                    </div>
                    <div className="flex-1 bg-secondary/10 rounded-lg px-2 py-2 text-center">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Рапид</p>
                      <p className="font-heading font-bold text-sm text-primary">{profile.fsr_rating_rapid ?? '—'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-heading font-bold text-sm text-primary mb-3 flex items-center gap-2">
                <Icon name="UserCog" size={16} className="text-secondary" /> Данные
              </h3>
              <dl className="flex flex-col gap-2.5 text-sm">
                <div><dt className="text-[10px] text-gray-400 uppercase tracking-wide">ID ФШР</dt><dd className="font-medium text-gray-800 mt-0.5">{profile.fsr_id || '—'}</dd></div>
                <div><dt className="text-[10px] text-gray-400 uppercase tracking-wide">Дата рождения</dt><dd className="font-medium text-gray-800 mt-0.5">{profile.birth_date ? formatDate(profile.birth_date) : '—'}</dd></div>
                <div><dt className="text-[10px] text-gray-400 uppercase tracking-wide">ФИО тренера</dt><dd className="font-medium text-gray-800 mt-0.5">{profile.coach_fio || '—'}</dd></div>
                <div><dt className="text-[10px] text-gray-400 uppercase tracking-wide">Учреждение</dt><dd className="font-medium text-gray-800 mt-0.5">{profile.institution || '—'}</dd></div>
                <div><dt className="text-[10px] text-gray-400 uppercase tracking-wide">Страна / Город</dt><dd className="font-medium text-gray-800 mt-0.5">{profile.country_city || '—'}</dd></div>
                <div><dt className="text-[10px] text-gray-400 uppercase tracking-wide">На платформе с</dt><dd className="font-medium text-gray-800 mt-0.5">{formatDate(profile.created_at)}</dd></div>
              </dl>
            </div>
          </div>

          <div className="min-w-0 flex flex-col gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 pb-0">
                <h3 className="font-heading font-bold text-lg text-primary mb-1 flex items-center gap-2">
                  <Icon name="Swords" size={20} className="text-secondary" /> Турниры
                </h3>
              </div>
              {tournaments.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <Icon name="Swords" size={32} className="mx-auto mb-2 opacity-30" />
                  <p>Игрок пока не участвовал в турнирах</p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-gray-50 mt-3">
                  {tournaments.map(t => (
                    <Link
                      key={t.tournament_id}
                      to={`/hall/${t.tournament_id}`}
                      className="px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap hover:bg-muted/40 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-gray-800 hover:text-secondary">{t.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {RATING_TYPE_LABELS[t.rating_type] || t.rating_type} · {t.hall_status === 'finished' ? 'Завершён' : t.hall_status === 'active' ? 'Идёт' : 'Не начат'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-sm">
                        {t.place && (
                          <span className="flex items-center gap-1 font-bold text-primary">
                            {t.place === 1 ? '🥇' : t.place === 2 ? '🥈' : t.place === 3 ? '🥉' : `${t.place} место`}
                          </span>
                        )}
                        <span className="text-gray-400">{t.points} очк.</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 pb-0">
                <h3 className="font-heading font-bold text-lg text-primary mb-1 flex items-center gap-2">
                  <Icon name="History" size={20} className="text-secondary" /> Последние партии
                </h3>
              </div>
              {games.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <Icon name="History" size={32} className="mx-auto mb-2 opacity-30" />
                  <p>Пока нет сыгранных партий</p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-gray-50 mt-3">
                  {games.map(g => {
                    const badgeClass =
                      g.outcome === 'win' ? 'bg-green-100 text-green-700' :
                      g.outcome === 'loss' ? 'bg-red-100 text-red-600' :
                      'bg-gray-100 text-gray-500';
                    const badgeLabel = g.outcome === 'win' ? 'Победа' : g.outcome === 'loss' ? 'Поражение' : 'Ничья';
                    const badgeIcon = g.outcome === 'win' ? 'Trophy' : g.outcome === 'loss' ? 'X' : 'Minus';

                    return (
                      <Link
                        key={g.id}
                        to={`/game/${g.id}`}
                        className="flex items-center gap-4 px-5 py-4 hover:bg-muted/40 transition-colors"
                      >
                        <MiniChessBoard fen={g.fen} size={72} />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${badgeClass}`}>
                              <Icon name={badgeIcon} size={11} /> {badgeLabel}
                            </span>
                            <span className="font-medium text-gray-800 truncate">
                              {g.my_color === 'white' ? 'Белыми' : 'Чёрными'} против {shortFio(g.opponent_fio) || 'соперника'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1 truncate">
                            {g.tournament_title} · Тур {g.round_number} · {RATING_TYPE_LABELS[g.rating_type] || g.rating_type}
                            {g.finished_at ? ` · ${formatDateTime(g.finished_at)}` : ''}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{resultLabel(g)} · {g.moves_count} {g.moves_count === 1 ? 'ход' : 'ходов'}</p>
                        </div>

                        <Icon name="ChevronRight" size={18} className="text-gray-300 shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
