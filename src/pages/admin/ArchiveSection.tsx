import { Application, Tournament, STATUS_COLORS, STATUS_LABELS, TOURNAMENTS_URL } from './adminTypes';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface ArchiveSectionProps {
  password: string;
  tournaments: Tournament[];
  apps: Application[];
  tLoading: boolean;
  fetchTournaments: () => Promise<void>;
}

export default function ArchiveSection({ password, tournaments, apps, tLoading, fetchTournaments }: ArchiveSectionProps) {
  const archived = tournaments.filter(t => t.status === 'archived');

  async function handleRestore(t: Tournament) {
    await fetch(TOURNAMENTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ _action: 'set_status', id: t.id, status: 'closed' }),
    });
    fetchTournaments();
  }

  async function handleDelete(id: number) {
    if (!confirm('Удалить турнир из архива безвозвратно?')) return;
    await fetch(TOURNAMENTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ _action: 'delete', id }),
    });
    fetchTournaments();
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Icon name="Archive" size={22} /> Архив турниров
        </h2>
      </div>

      {tLoading ? <div className="text-center py-12 text-gray-400">Загрузка...</div>
        : archived.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Icon name="Archive" size={40} className="mx-auto mb-3 opacity-30" />
            <p>В архиве пока пусто</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {archived.map(t => {
              const tApps = apps.filter(a => a.tournament_id === t.id);
              return (
                <div key={t.id} className="bg-white rounded-2xl shadow p-5 opacity-90">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-bold text-lg text-primary">{t.title}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">
                          В архиве
                        </span>
                        {tApps.length > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                            {tApps.length} заявок
                          </span>
                        )}
                      </div>
                      {t.date && <p className="text-sm text-gray-500 mb-1">{new Date(t.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
                      {t.location && <p className="text-sm text-gray-500">{t.location}</p>}
                    </div>
                    <div className="flex gap-2 flex-wrap shrink-0">
                      <Button variant="outline" size="sm" onClick={() => handleRestore(t)}>
                        <Icon name="ArchiveRestore" size={14} className="mr-1" /> Восстановить
                      </Button>
                      <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50" onClick={() => handleDelete(t.id)}>
                        <Icon name="Trash2" size={14} className="mr-1" /> Удалить
                      </Button>
                    </div>
                  </div>
                  {tApps.length > 0 && (
                    <div className="border-t border-gray-100 pt-4 mt-4">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Участники</p>
                      <div className="flex flex-col gap-1">
                        {tApps.map((a, i) => (
                          <div key={a.id} className="flex items-center gap-2 text-sm">
                            <span className="text-gray-400 w-5 shrink-0">{i + 1}.</span>
                            <span className="font-medium text-gray-800">{a.fio}</span>
                            {a.age && <span className="text-gray-400">· {a.age}</span>}
                            {a.country_city && <span className="text-gray-400">· {a.country_city}</span>}
                            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-600'}`}>
                              {STATUS_LABELS[a.status] || a.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
    </>
  );
}
