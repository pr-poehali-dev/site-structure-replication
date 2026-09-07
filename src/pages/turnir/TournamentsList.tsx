import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Tournament, formatDate } from './types';

interface TournamentsListProps {
  tournaments: Tournament[];
  loading: boolean;
  onOpenModal: (t: Tournament) => void;
  onOpenParticipants: (t: Tournament) => void;
  onOpenImagePreview: (preview: { url: string; title: string }) => void;
}

export default function TournamentsList({
  tournaments, loading, onOpenModal, onOpenParticipants, onOpenImagePreview,
}: TournamentsListProps) {
  return (
    <div className="lg:col-span-2">
      <div className="flex items-center gap-3 mb-7">
        <h2 className="font-heading font-bold text-2xl md:text-3xl text-primary uppercase shrink-0">Список турниров</h2>
        <div className="h-px flex-1 bg-border" />
      </div>
      {loading ? (
        <div className="text-center py-20 text-gray-400">
          <Icon name="Loader" size={36} className="mx-auto mb-3 opacity-40 animate-spin" />
          <p>Загрузка турниров...</p>
        </div>
      ) : tournaments.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Icon name="Swords" size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-xl font-medium">Турниров пока нет</p>
          <p className="mt-2 text-sm">Следите за обновлениями — скоро появятся новые соревнования</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {tournaments.map(t => {
            const isOpen = t.status !== 'closed';
            const hasPreviews = !!(t.announcement_url || t.diploma_sample_url);
            return (
            <div key={t.id} className={`bg-white rounded-2xl shadow-md border flex flex-col md:flex-row overflow-hidden transition-shadow ${isOpen ? 'border-gray-100 hover:shadow-lg' : 'border-gray-200 opacity-80'}`}>
              <div className="flex-1 flex flex-col min-w-0">
                <div className={`px-6 py-5 border-b border-gray-100 ${isOpen ? 'bg-primary/5' : 'bg-gray-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-heading font-bold text-xl text-primary leading-tight">{t.title}</h2>
                    <span className={`shrink-0 text-xs px-2 py-1 rounded-full font-semibold ${isOpen ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {isOpen ? 'Приём открыт' : 'Приём закрыт'}
                    </span>
                  </div>
                  {t.date && (
                    <p className="mt-1 text-secondary font-semibold text-sm flex items-center gap-1">
                      <Icon name="Calendar" size={14} /> {formatDate(t.date)}{t.time_msk && `, ${t.time_msk} МСК`}
                    </p>
                  )}
                </div>
                <div className="px-6 py-4 flex-1 flex flex-col gap-3">
                  {t.description && <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{t.description}</p>}
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
                <div className="px-6 pb-5 flex flex-col sm:flex-row gap-2">
                  {isOpen ? (
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
                <div className="flex flex-row md:flex-col gap-4 p-4 md:w-64 shrink-0 bg-gray-50 border-t md:border-t-0 md:border-l border-gray-100">
                  {t.announcement_url && (
                    <button type="button" onClick={() => onOpenImagePreview({ url: t.announcement_url as string, title: `Анонс — ${t.title}` })} className="flex-1 flex flex-col gap-1.5 group text-left">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Анонс</span>
                      <div className="flex-1 min-h-32 bg-white rounded-lg border border-gray-200 flex items-center justify-center p-1.5 group-hover:border-secondary/50 transition-colors cursor-zoom-in">
                        <img src={t.announcement_url} alt={`Анонс турнира: ${t.title}`} className="max-w-full max-h-40 object-contain" />
                      </div>
                    </button>
                  )}
                  {t.diploma_sample_url && (
                    <button type="button" onClick={() => onOpenImagePreview({ url: t.diploma_sample_url as string, title: `Образец диплома — ${t.title}` })} className="flex-1 flex flex-col gap-1.5 group text-left">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Образец диплома</span>
                      <div className="flex-1 min-h-32 bg-white rounded-lg border border-gray-200 flex items-center justify-center p-1.5 group-hover:border-secondary/50 transition-colors cursor-zoom-in">
                        <img src={t.diploma_sample_url} alt={`Образец диплома турнира: ${t.title}`} className="max-w-full max-h-40 object-contain" />
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
