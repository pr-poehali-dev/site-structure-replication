import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { ru } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Tournament, formatDate } from './types';
import { useAuth } from '@/contexts/AuthContext';
import { isSpectatorLogin } from '@/lib/spectators';
import TournamentTypeBadge, { RatingTypeBadge, getTypeMeta } from './TournamentTypeBadge';

interface MyApplication {
  tournament_id: number;
  status: string;
  hall_open: boolean;
  hall_status: string;
}

interface TournamentsListProps {
  tournaments: Tournament[];
  loading: boolean;
  onOpenModal: (t: Tournament) => void;
  onOpenParticipants: (t: Tournament) => void;
  onOpenImagePreview: (preview: { url: string; title: string }) => void;
  appliedTournamentIds: number[];
  myApplications: MyApplication[];
  onCancelApplication: (t: Tournament) => void;
  cancellingId: number | null;
}

const TYPE_FILTERS = [
  { id: 'all', label: 'Все типы' },
  { id: 'warmup', label: 'Разминочные' },
  { id: 'training', label: 'Тренировочные' },
  { id: 'qualifying', label: 'Квалификационные' },
];
const FORMAT_FILTERS = [
  { id: 'all', label: 'Любой формат' },
  { id: 'blitz', label: 'Блиц' },
  { id: 'rapid', label: 'Рапид' },
];

function FilterSelect({ items, value, onChange }: { items: { id: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-full sm:w-48 text-sm"><SelectValue /></SelectTrigger>
      <SelectContent>
        {items.map(i => <SelectItem key={i.id} value={i.id}>{i.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export default function TournamentsList({
  tournaments: allTournaments, loading, onOpenModal, onOpenParticipants, onOpenImagePreview,
  appliedTournamentIds, myApplications, onCancelApplication, cancellingId,
}: TournamentsListProps) {
  const { user } = useAuth();
  const isSpectator = isSpectatorLogin(user?.login);
  const [pickedDate, setPickedDate] = useState<Date | undefined>();
  const toKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const tournamentDays = allTournaments.filter(t => t.date).map(t => { const [y, m, d] = t.date!.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); });
  const [typeF, setTypeF] = useState('all');
  const [formatF, setFormatF] = useState('all');
  const tournaments = allTournaments.filter(t =>
    (!pickedDate || t.date?.slice(0, 10) === toKey(pickedDate)) &&
    (typeF === 'all' || (t.tournament_type || 'qualifying') === typeF) &&
    (formatF === 'all' || (t.rating_type || 'rapid') === formatF)
  );
  const filtersActive = !!pickedDate || typeF !== 'all' || formatF !== 'all';
  return (
    <div className="lg:col-span-2">
      <div className="flex items-center gap-3 mb-7">
        <h2 className="font-heading font-bold text-2xl md:text-3xl text-primary uppercase shrink-0">Список турниров</h2>
        <div className="h-px flex-1 bg-border" />
      </div>
      {!loading && allTournaments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 mb-6 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-9 w-full sm:w-48 justify-start text-sm font-normal">
                <Icon name="CalendarDays" size={16} className="mr-2" />
                {pickedDate ? pickedDate.toLocaleDateString('ru-RU') : 'Любая дата'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                locale={ru}
                weekStartsOn={1}
                selected={pickedDate}
                onSelect={setPickedDate}
                modifiers={{ hasTournament: tournamentDays }}
                modifiersClassNames={{ hasTournament: 'bg-secondary/20 text-secondary font-bold rounded-md' }}
              />
              {pickedDate && (
                <div className="border-t p-2">
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => setPickedDate(undefined)}>Сбросить дату</Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
          <FilterSelect items={TYPE_FILTERS} value={typeF} onChange={setTypeF} />
          <FilterSelect items={FORMAT_FILTERS} value={formatF} onChange={setFormatF} />
        </div>
      )}
      {loading ? (
        <div className="text-center py-20 text-gray-400">
          <Icon name="Loader" size={36} className="mx-auto mb-3 opacity-40 animate-spin" />
          <p>Загрузка турниров...</p>
        </div>
      ) : tournaments.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Icon name="Swords" size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-xl font-medium">{filtersActive ? 'Ничего не найдено' : 'Турниров пока нет'}</p>
          <p className="mt-2 text-sm">{filtersActive ? 'Попробуйте изменить фильтры' : 'Следите за обновлениями — скоро появятся новые соревнования'}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {tournaments.map(t => {
            const isCancelled = t.status === 'cancelled';
            const isOpen = t.status !== 'closed' && !isCancelled;
            const hasPreviews = !!(t.announcement_url || t.diploma_sample_url);
            const isApplied = appliedTournamentIds.includes(t.id);
            const myApp = myApplications.find(a => a.tournament_id === t.id);
            const hallOpen = myApp?.hall_open || false;
            const hallLocked = hallOpen || (!!myApp && myApp.hall_status !== 'not_started' && !!myApp.hall_status);
            return (
            <div key={t.id} className={`bg-white rounded-2xl shadow-md border flex flex-col md:flex-row overflow-hidden transition-shadow ${isOpen ? 'border-gray-100 hover:shadow-lg' : 'border-gray-200 opacity-80'}`}>
              <div className={`h-1.5 md:h-auto md:w-1.5 shrink-0 ${getTypeMeta(t.tournament_type).bar}`} />
              <div className="flex-1 flex flex-col min-w-0">
                <div className={`px-6 py-5 border-b border-gray-100 ${isOpen ? 'bg-primary/5' : 'bg-gray-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex flex-col items-start gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <TournamentTypeBadge type={t.tournament_type} />
                        <RatingTypeBadge type={t.rating_type} />
                      </div>
                      <h2 className="font-heading font-bold text-xl text-primary leading-tight">{t.title}</h2>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${isCancelled ? 'bg-red-100 text-red-700' : isOpen ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {isCancelled ? 'Турнир отменён' : isOpen ? 'Приём открыт' : 'Приём закрыт'}
                      </span>
                      {isOpen && t.spots_left != null && (
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold flex items-center gap-1 ${t.spots_left <= 3 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                          <Icon name="Users" size={12} />
                          {t.spots_left > 0 ? `Осталось мест: ${t.spots_left}` : 'Мест нет'}
                        </span>
                      )}
                    </div>
                  </div>
                  {t.date && (
                    <div className="mt-3 inline-flex items-center gap-3 rounded-xl bg-secondary/10 px-4 py-2.5">
                      <Icon name="CalendarDays" size={22} className="text-secondary shrink-0" />
                      <div className="leading-tight">
                        <p className="font-heading font-bold text-lg text-primary">{formatDate(t.date)}</p>
                        <p className="text-sm text-gray-600 capitalize">
                          {new Date(t.date).toLocaleDateString('ru-RU', { weekday: 'long' })}
                          {t.time_msk && <span className="normal-case">, начало в {t.time_msk} МСК</span>}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="px-6 py-4 flex-1 flex flex-col gap-3">
                  {isCancelled && (
                    <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                      <Icon name="Ban" size={16} className="shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Турнир отменён</p>
                        {t.cancel_reason && <p className="mt-0.5">Причина: {t.cancel_reason}</p>}
                      </div>
                    </div>
                  )}
                  {t.description && (
                    <Collapsible className="group">
                      <CollapsibleTrigger className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                        Описание турнира
                        <Icon name="ChevronDown" size={16} className="transition-transform group-data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line mt-2">{t.description}</p>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                  <div className="flex flex-col gap-1.5 text-sm text-gray-500 mt-auto">
                    {t.location && <span className="flex items-center gap-2"><Icon name="MapPin" size={14} className="text-secondary" />{t.location}</span>}
                    {t.age_category && <span className="flex items-center gap-2"><Icon name="Users" size={14} className="text-secondary" />{t.age_category}</span>}
                    {t.price && <span className="flex items-center gap-2"><Icon name="CreditCard" size={14} className="text-secondary" />Взнос: {t.price} ₽</span>}
                    {t.time_control && <span className="flex items-center gap-2"><Icon name="Timer" size={14} className="text-secondary" />Контроль времени: {t.time_control}</span>}
                    {t.regulation_url && (
                      <a href={t.regulation_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-medium text-primary hover:underline">
                        <Icon name="ScrollText" size={14} /> Положение (PDF)
                      </a>
                    )}
                  </div>
                </div>
                {isSpectator && t.lila_tournament_id && (
                  <div className="px-6 pb-3">
                    <Link to={`/room/${t.id}`}>
                      <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold">
                        <Icon name="Eye" size={16} className="mr-2" /> Войти в зал (просмотр)
                      </Button>
                    </Link>
                  </div>
                )}
                {isApplied && !isSpectator && !isCancelled && (
                  <div className="px-6 pb-3">
                    {hallOpen ? (
                      <Link to={`/room/${t.id}`}>
                        <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold">
                          <Icon name="DoorOpen" size={16} className="mr-2" /> Войти в турнирный зал
                        </Button>
                      </Link>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="w-full flex items-center justify-center gap-2 rounded-lg bg-gray-100 text-gray-400 font-semibold py-2.5 text-sm cursor-help">
                            <Icon name="Lock" size={15} /> Войти в турнирный зал
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[240px] text-xs leading-relaxed">
                          Турнирный зал открывается за полчаса до начала турнира
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                )}
                {!isCancelled && !isSpectator && (
                  <div className="px-6 pb-3">
                    <Link to={`/room/${t.id}?guest=1`}>
                      <Button variant="outline" className="w-full border-primary/30 text-primary hover:bg-primary/5 font-semibold">
                        <Icon name="Eye" size={16} className="mr-2" /> Гостевой вход (просмотр)
                      </Button>
                    </Link>
                  </div>
                )}
                <div className="px-6 pb-5 flex flex-col sm:flex-row gap-2">
                  {isCancelled ? (
                    <div className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-red-50 text-red-600 font-semibold py-2.5 text-sm">
                      <Icon name="Ban" size={15} /> Турнир отменён
                    </div>
                  ) : isApplied && hallLocked ? (
                    <div className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-emerald-50 text-emerald-700 font-semibold py-2.5 text-sm">
                      <Icon name="CheckCircle2" size={15} /> Вы участвуете
                    </div>
                  ) : isApplied ? (
                    <Button
                      variant="outline"
                      className="flex-1 text-red-500 border-red-200 hover:bg-red-50 font-semibold"
                      disabled={cancellingId === t.id}
                      onClick={() => onCancelApplication(t)}
                    >
                      <Icon name={cancellingId === t.id ? 'Loader2' : 'XCircle'} size={16} className={`mr-2 ${cancellingId === t.id ? 'animate-spin' : ''}`} />
                      Отменить участие
                    </Button>
                  ) : isOpen ? (
                    <Button className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold" onClick={() => onOpenModal(t)}>
                      <Icon name="ClipboardCheck" size={16} className="mr-2" /> Подать заявку
                    </Button>
                  ) : (
                    <div className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-gray-100 text-gray-400 font-semibold py-2.5 text-sm">
                      <Icon name="Lock" size={15} /> Приём заявок завершён
                    </div>
                  )}
                  <Button variant="outline" className="flex-1 text-primary border-primary/30 hover:bg-primary/5" onClick={() => onOpenParticipants(t)}>
                    <Icon name="Users" size={16} className="mr-2" /> Список участников
                  </Button>
                </div>
              </div>

              {hasPreviews && (
                <div className="flex flex-row md:flex-col gap-4 p-4 md:w-64 shrink-0 bg-gray-50 border-t md:border-t-0 md:border-l border-gray-100 md:self-start">
                  {t.announcement_url && (
                    <button type="button" onClick={() => onOpenImagePreview({ url: t.announcement_url as string, title: `Анонс — ${t.title}` })} className="flex-1 md:flex-none flex flex-col gap-1.5 group text-left">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Анонс</span>
                      <div className="bg-white rounded-lg border border-gray-200 flex items-center justify-center p-1.5 group-hover:border-secondary/50 transition-colors cursor-zoom-in">
                        <img src={t.announcement_url} alt={`Анонс турнира: ${t.title}`} className="w-full h-auto max-h-40 object-contain" />
                      </div>
                    </button>
                  )}
                  {t.diploma_sample_url && (
                    <button type="button" onClick={() => onOpenImagePreview({ url: t.diploma_sample_url as string, title: `Образец диплома — ${t.title}` })} className="flex-1 md:flex-none flex flex-col gap-1.5 group text-left">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Образец диплома</span>
                      <div className="bg-white rounded-lg border border-gray-200 flex items-center justify-center p-1.5 group-hover:border-secondary/50 transition-colors cursor-zoom-in">
                        <img src={t.diploma_sample_url} alt={`Образец диплома турнира: ${t.title}`} className="w-full h-auto max-h-40 object-contain" />
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}