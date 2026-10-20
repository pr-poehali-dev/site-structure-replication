import { useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/contexts/AuthContext';
import { ELECTRONIC_RESULTS_URL, NOMINATIONS, ResultsSnapshot } from '@/lib/electronicResults';

interface Props {
  tournamentId: number;
}

export default function MyResultBlock({ tournamentId }: Props) {
  const { user } = useAuth();
  const [snap, setSnap] = useState<ResultsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(`${ELECTRONIC_RESULTS_URL}?tournament_id=${tournamentId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive) setSnap(d); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [tournamentId]);

  if (loading) {
    return <p className="text-xs text-gray-400 flex items-center gap-2"><Icon name="Loader2" size={14} className="animate-spin" /> Загружаем ваш результат...</p>;
  }
  if (!snap || !user) return null;

  const me = snap.overall.find(r => r.user_id === user.id);
  if (!me) return null;

  const group = snap.groups.find(g => g.name === me.group);
  const groupRow = group?.table.find(r => r.user_id === user.id);
  const noms = group
    ? NOMINATIONS.flatMap(n =>
        (group.nominations[n.kind] || [])
          .filter(e => e.username.toLowerCase() === me.username.toLowerCase())
          .map(e => ({ label: n.label, place: e.place, places: n.places }))
      )
    : [];

  return (
    <div className="rounded-lg border border-secondary/40 bg-secondary/10 px-4 py-3 flex flex-col gap-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ваш результат</p>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-700">
        <span className="flex items-center gap-2">
          <Icon name="Trophy" size={14} className="text-secondary shrink-0" />
          Общий зачёт: <b className="text-primary">{me.rank ? `${me.rank}-е место` : '—'}</b>
          <span className="text-gray-400">({me.points} очк.)</span>
        </span>
        {group && groupRow && (
          <span className="flex items-center gap-2">
            <Icon name="Users" size={14} className="text-secondary shrink-0" />
            {group.name}: <b className="text-primary">{groupRow.place}-е место</b>
          </span>
        )}
      </div>
      {noms.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {noms.map((n, i) => (
            <span key={i} className="text-xs px-2.5 py-1 rounded-full font-semibold bg-white border border-secondary/40 text-primary flex items-center gap-1">
              <Icon name="Award" size={12} className="text-secondary" />
              {n.label}{n.places > 1 ? `, ${n.place}-е место` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
