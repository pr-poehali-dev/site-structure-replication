import { useState, useEffect } from 'react';
import { Header, Footer } from '@/components/Layout';
import Icon from '@/components/ui/icon';

const RESULTS_URL = 'https://functions.poehali.dev/63f1c6fa-4f4f-4834-94be-73b844b9d51a';

interface OlympiadResult {
  id: number;
  title: string;
  url: string;
  sort_order: number;
}

interface TournamentResult {
  id: number;
  number: number | null;
  date: string | null;
  title: string;
  fsr_rating: string | null;
  protocol_url: string | null;
  regulation_url: string | null;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function Result() {
  const [olympiads, setOlympiads] = useState<OlympiadResult[]>([]);
  const [tournaments, setTournaments] = useState<TournamentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch(RESULTS_URL)
      .then(r => r.json())
      .then(data => {
        setOlympiads(data.olympiads || []);
        setTournaments(data.tournaments || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = tournaments.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    (t.fsr_rating || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      {/* Hero */}
      <section className="bg-primary text-white relative overflow-hidden">
        <div className="absolute inset-0 chess-grid opacity-40" />
        <div className="container relative px-4 py-10 md:py-14 max-w-4xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/15 text-secondary text-sm font-semibold mb-6">
            <Icon name="ListChecks" size={15} /> Протоколы и итоги
          </span>
          <h1 className="font-heading font-bold text-4xl md:text-6xl uppercase leading-tight">
            Результаты <span className="text-secondary">соревнований</span>
          </h1>
          <p className="mt-5 text-white/75 text-lg max-w-2xl mx-auto">
            Итоговые таблицы, протоколы и положения прошедших соревнований
          </p>
        </div>
      </section>

      <div className="container px-4 py-12 max-w-5xl mx-auto space-y-14">

        {/* Секция: Результаты Олимпиад */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-8 bg-secondary rounded-full" />
            <h2 className="font-heading font-bold text-2xl text-primary">Результаты Олимпиад</h2>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-6">
              <Icon name="Loader2" size={20} className="animate-spin" /> Загрузка...
            </div>
          ) : olympiads.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground text-center">
              <Icon name="Trophy" size={40} className="opacity-25" />
              <p>Результаты олимпиад пока не добавлены</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {olympiads.map(o => (
                <a
                  key={o.id}
                  href={o.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 px-5 py-4 rounded-xl border border-border bg-white hover:border-secondary hover:shadow-md transition-all group"
                >
                  <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                    <Icon name="TableProperties" size={20} className="text-secondary" />
                  </div>
                  <span className="flex-1 font-medium text-primary group-hover:text-secondary transition-colors">{o.title}</span>
                  <Icon name="ExternalLink" size={16} className="text-muted-foreground group-hover:text-secondary transition-colors shrink-0" />
                </a>
              ))}
            </div>
          )}
        </section>

        {/* Секция: Результаты Турниров */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-8 bg-secondary rounded-full" />
            <h2 className="font-heading font-bold text-2xl text-primary">Результаты турниров</h2>
          </div>

          {/* Поиск */}
          <div className="relative mb-4">
            <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Поиск по названию или рейтингу ФШР..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-secondary"
            />
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-6">
              <Icon name="Loader2" size={20} className="animate-spin" /> Загрузка...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground text-center">
              <Icon name="FileSearch" size={40} className="opacity-25" />
              <p>{search ? 'Ничего не найдено' : 'Результаты турниров пока не добавлены'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-primary/5 border-b border-border">
                    <th className="px-4 py-3 text-left font-semibold text-primary w-12">№</th>
                    <th className="px-4 py-3 text-left font-semibold text-primary">Дата</th>
                    <th className="px-4 py-3 text-left font-semibold text-primary">Название турнира</th>
                    <th className="px-4 py-3 text-left font-semibold text-primary">Рейтинг ФШР</th>
                    <th className="px-4 py-3 text-center font-semibold text-primary">Протокол</th>
                    <th className="px-4 py-3 text-center font-semibold text-primary">Положение</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t, idx) => (
                    <tr key={t.id} className={`border-b border-border last:border-0 hover:bg-secondary/5 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <td className="px-4 py-3 text-muted-foreground font-medium">{t.number ?? idx + 1}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {t.date ? formatDate(t.date) : '—'}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{t.title}</td>
                      <td className="px-4 py-3 text-muted-foreground">{t.fsr_rating || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        {t.protocol_url ? (
                          <a href={t.protocol_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-secondary/10 text-secondary hover:bg-secondary hover:text-white transition-colors text-xs font-medium">
                            <Icon name="FileText" size={13} /> Открыть
                          </a>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {t.regulation_url ? (
                          <a href={t.regulation_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors text-xs font-medium">
                            <Icon name="BookOpen" size={13} /> Открыть
                          </a>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <Footer />
    </div>
  );
}
