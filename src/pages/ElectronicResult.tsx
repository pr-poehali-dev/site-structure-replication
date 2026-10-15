import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Header, Footer } from '@/components/Layout';
import Icon from '@/components/ui/icon';
import Seo from '@/components/Seo';
import {
  ELECTRONIC_RESULTS_URL, NOMINATIONS, ResultRow, ResultsSnapshot,
} from '@/lib/electronicResults';

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function Table({ rows, grouped }: { rows: ResultRow[]; grouped?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground border-b bg-gray-50">
            <th className="py-2.5 px-3 w-12">М</th>
            <th className="px-3">Участник</th>
            <th className="px-3">Возраст</th>
            <th className="px-3 text-right">Очки</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const place = grouped ? r.place ?? i + 1 : r.rank ?? i + 1;
            return (
              <tr key={r.username} className="border-b border-gray-50 last:border-0">
                <td className="py-2 px-3 font-semibold">{MEDALS[place] || place}</td>
                <td className="px-3">
                  {r.user_id ? <Link to={`/player/${r.user_id}`} className="hover:text-secondary">{r.fio}</Link> : r.fio}
                </td>
                <td className="px-3">{r.age ?? '—'}</td>
                <td className="px-3 text-right font-semibold">{r.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ElectronicResult() {
  const { tournamentId } = useParams();
  const [data, setData] = useState<ResultsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overall');

  useEffect(() => {
    fetch(`${ELECTRONIC_RESULTS_URL}?tournament_id=${tournamentId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }, [tournamentId]);

  const group = data?.groups.find(g => g.name === tab);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Seo title={data ? `Результаты: ${data.tournament.title}` : 'Результаты турнира'} description="Итоговые результаты турнира" />
      <Header />
      <main className="flex-1 container px-4 py-10 max-w-4xl mx-auto w-full">
        <Link to="/result" className="text-sm text-muted-foreground hover:text-secondary flex items-center gap-1 mb-4">
          <Icon name="ArrowLeft" size={14} /> Все результаты
        </Link>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-10">
            <Icon name="Loader2" size={20} className="animate-spin" /> Загрузка...
          </div>
        ) : !data ? (
          <p className="text-muted-foreground py-10">Результаты этого турнира пока не опубликованы</p>
        ) : (
          <>
            <h1 className="font-heading font-bold text-3xl text-primary mb-3">{data.tournament.title}</h1>
            {data.tournament.has_hall && (
              <Link
                to={`/room/${data.tournament.id}`}
                className="inline-flex items-center gap-2 text-sm font-medium text-secondary hover:underline mb-6"
              >
                <Icon name="Trophy" size={16} /> Открыть турнирный зал
              </Link>
            )}
            <div className="flex flex-wrap gap-2 mb-6">
              {[{ name: 'overall', label: 'Общий зачёт' }, ...data.groups.map(g => ({ name: g.name, label: g.name }))].map(t => (
                <button key={t.name} onClick={() => setTab(t.name)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${tab === t.name ? 'bg-secondary text-secondary-foreground border-secondary' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'overall' && <Table rows={data.overall} />}

            {group && (
              <div className="flex flex-col gap-6">
                <Table rows={group.table} grouped />
                <div className="grid sm:grid-cols-3 gap-4">
                  {NOMINATIONS.map(nom => {
                    const winners = group.nominations[nom.kind] || [];
                    if (!winners.length) return null;
                    return (
                      <div key={nom.kind} className="rounded-xl border border-border bg-white p-4">
                        <p className="font-heading font-bold text-primary mb-2">{nom.label}</p>
                        <div className="flex flex-col gap-1.5 text-sm">
                          {winners.map(w => (
                            <div key={w.place} className="flex items-center gap-2">
                              <span>{nom.places > 1 ? MEDALS[w.place] : '🏆'}</span>
                              <span className="flex-1">{w.fio || w.username}</span>
                              {w.game_url && (
                                <a href={w.game_url} target="_blank" rel="noopener noreferrer" className="text-secondary" title="Партия">
                                  <Icon name="ExternalLink" size={14} />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
