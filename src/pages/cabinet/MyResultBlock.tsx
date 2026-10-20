import { useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/contexts/AuthContext';
import { ELECTRONIC_RESULTS_URL, NOMINATIONS, ResultFile, ResultsSnapshot } from '@/lib/electronicResults';

interface Props {
  tournamentId: number;
}

export default function MyResultBlock({ tournamentId }: Props) {
  const { user, token } = useAuth();
  const [files, setFiles] = useState<ResultFile[]>([]);
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

  useEffect(() => {
    if (!token) return;
    fetch(`${ELECTRONIC_RESULTS_URL}?tournament_id=${tournamentId}&my_files=1`, { headers: { 'X-Auth-Token': token } })
      .then(r => (r.ok ? r.json() : null))
      .then(d => setFiles(d?.files || []))
      .catch(() => {});
  }, [tournamentId, token]);

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
          .map(e => ({ label: n.label, place: e.place, places: n.places, kind: n.kind }))
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
      {(files.some(f => f.kind === 'diploma' || f.kind === 'thanks') || noms.some(n => files.some(f => f.kind === `nom_${n.kind}`))) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {files.filter(f => f.kind === 'diploma').map(f => (
            <a key={f.kind} href={f.file_url} target="_blank" rel="noopener noreferrer" download
              className="text-xs px-3 py-1.5 rounded-full font-semibold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5">
              <Icon name="Download" size={13} /> Скачать диплом
            </a>
          ))}
          {files.filter(f => f.kind === 'thanks').map(f => (
            <a key={f.kind} href={f.file_url} target="_blank" rel="noopener noreferrer" download
              className="text-xs px-3 py-1.5 rounded-full font-semibold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5">
              <Icon name="Download" size={13} /> Скачать благодарственное письмо
            </a>
          ))}
          {noms.map((n, i) => {
            const f = files.find(x => x.kind === `nom_${n.kind}`);
            return f ? (
              <a key={i} href={f.file_url} target="_blank" rel="noopener noreferrer" download
                className="text-xs px-3 py-1.5 rounded-full font-semibold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5">
                <Icon name="Download" size={13} /> Диплом: {n.label}
              </a>
            ) : null;
          })}
        </div>
      )}
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
