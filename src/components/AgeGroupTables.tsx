import { useEffect, useState } from 'react';
import ResultTable from '@/components/ResultTable';
import { ELECTRONIC_RESULTS_URL, ResultsSnapshot } from '@/lib/electronicResults';

export default function AgeGroupTables({ tournamentId }: { tournamentId: string }) {
  const [data, setData] = useState<ResultsSnapshot | null>(null);

  useEffect(() => {
    fetch(`${ELECTRONIC_RESULTS_URL}?tournament_id=${encodeURIComponent(tournamentId)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, [tournamentId]);

  const groups = (data?.groups || []).filter(g => g.table && g.table.length > 0);
  if (!groups.length) return null;

  return (
    <div className="flex flex-col gap-5">
      {groups.map(g => (
        <section key={g.name}>
          <h2 className="font-heading font-bold text-xl text-primary mb-2">{g.name}</h2>
          <ResultTable rows={g.table} grouped />
        </section>
      ))}
    </div>
  );
}
