import { useState, useEffect, useMemo } from 'react';
import { Header, Footer } from '@/components/Layout';
import Icon from '@/components/ui/icon';

const RESULTS_URL = 'https://functions.poehali.dev/63f1c6fa-4f4f-4834-94be-73b844b9d51a';
const PAGE_SIZE = 20;

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

  const [filterTitle, setFilterTitle] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterRating, setFilterRating] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch(RESULTS_URL)
      .then(r => r.json())
      .then(data => {
        setOlympiads(data.olympiads || []);
        setTournaments(data.tournaments || []);
      })
      .finally(() => setLoading(false));
  }, []);

  // Уникальные значения рейтинга для select
  const ratingOptions = useMemo(() => {
    const vals = tournaments.map(t => t.fsr_rating).filter(Boolean) as string[];
    return Array.from(new Set(vals)).sort();
  }, [tournaments]);

  const filtered = useMemo(() => {
    return tournaments.filter(t => {
      const titleOk = !filterTitle || t.title.toLowerCase().includes(filterTitle.toLowerCase());
      const ratingOk = !filterRating || (t.fsr_rating || '') === filterRating;
      const dateOk = !filterDate || (t.date || '').startsWith(filterDate);
      return titleOk && ratingOk && dateOk;
    });
  }, [tournaments, filterTitle, filterDate, filterRating]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const resetPage = () => setPage(1);

  const hasFilters = filterTitle || filterDate || filterRating;

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

          {/* Фильтры */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="relative">
              <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Название турнира..."
                value={filterTitle}
                onChange={e => { setFilterTitle(e.target.value); resetPage(); }}
                className="w-full pl-9 pr-4 py-2.5 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>
            <div className="relative">
              <Icon name="Calendar" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="month"
                value={filterDate}
                onChange={e => { setFilterDate(e.target.value); resetPage(); }}
                className="w-full pl-9 pr-4 py-2.5 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>
            <div className="relative">
              <Icon name="Star" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <select
                value={filterRating}
                onChange={e => { setFilterRating(e.target.value); resetPage(); }}
                className="w-full pl-9 pr-4 py-2.5 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-secondary appearance-none"
              >
                <option value="">Все рейтинги ФШР</option>
                {ratingOptions.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Сброс фильтров */}
          {hasFilters && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-muted-foreground">Найдено: {filtered.length}</span>
              <button
                onClick={() => { setFilterTitle(''); setFilterDate(''); setFilterRating(''); resetPage(); }}
                className="text-sm text-secondary hover:underline flex items-center gap-1"
              >
                <Icon name="X" size={13} /> Сбросить фильтры
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-6">
              <Icon name="Loader2" size={20} className="animate-spin" /> Загрузка...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground text-center">
              <Icon name="FileSearch" size={40} className="opacity-25" />
              <p>{hasFilters ? 'Ничего не найдено' : 'Результаты турниров пока не добавлены'}</p>
            </div>
          ) : (
            <>
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
                    {paginated.map((t, idx) => (
                      <tr key={t.id} className={`border-b border-border last:border-0 hover:bg-secondary/5 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <td className="px-4 py-3 text-muted-foreground font-medium">{t.number ?? (page - 1) * PAGE_SIZE + idx + 1}</td>
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

              {/* Пагинация */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Страница {page} из {totalPages} · {filtered.length} записей
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                      className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Первая"
                    >
                      <Icon name="ChevronsLeft" size={16} />
                    </button>
                    <button
                      onClick={() => setPage(p => p - 1)}
                      disabled={page === 1}
                      className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Предыдущая"
                    >
                      <Icon name="ChevronLeft" size={16} />
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                      .reduce<(number | '...')[]>((acc, p, i, arr) => {
                        if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, i) =>
                        p === '...' ? (
                          <span key={`dots-${i}`} className="px-2 text-muted-foreground text-sm">…</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setPage(p as number)}
                            className={`min-w-[32px] h-8 px-2 rounded-lg text-sm font-medium transition-colors ${page === p ? 'bg-primary text-white' : 'hover:bg-gray-100 text-foreground'}`}
                          >
                            {p}
                          </button>
                        )
                      )}

                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={page === totalPages}
                      className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Следующая"
                    >
                      <Icon name="ChevronRight" size={16} />
                    </button>
                    <button
                      onClick={() => setPage(totalPages)}
                      disabled={page === totalPages}
                      className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Последняя"
                    >
                      <Icon name="ChevronsRight" size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <Footer />
    </div>
  );
}
