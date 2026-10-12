import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/contexts/AuthContext';
import { PUZZLES_URL } from '@/lib/puzzles';

export default function PuzzlesSection() {
  const { token } = useAuth();
  const [stats, setStats] = useState<{ solved: number; total: number; rank: number | null } | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${PUZZLES_URL}?me=1`, { headers: { 'X-Auth-Token': token } })
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }, [token]);

  const percent = stats && stats.total ? Math.round((stats.solved / stats.total) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-4">
      <h2 className="font-heading font-bold text-lg text-primary flex items-center gap-2"><Icon name="Puzzle" size={20} className="text-secondary" />Мои задачи</h2>
      {!stats ? (
        <Icon name="Loader2" size={22} className="animate-spin text-gray-400" />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-gray-50 p-3 text-center"><p className="text-2xl font-bold text-primary">{stats.solved}</p><p className="text-xs text-gray-500">Решено</p></div>
            <div className="rounded-xl bg-gray-50 p-3 text-center"><p className="text-2xl font-bold text-primary">{stats.total}</p><p className="text-xs text-gray-500">Всего задач</p></div>
            <div className="rounded-xl bg-gray-50 p-3 text-center"><p className="text-2xl font-bold text-primary">{stats.rank ?? '—'}</p><p className="text-xs text-gray-500">Место в рейтинге</p></div>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-secondary" style={{ width: `${percent}%` }} /></div>
          <Link to="/puzzles" className="text-sm font-medium text-secondary hover:underline flex items-center gap-1">Решать задачи <Icon name="ArrowRight" size={14} /></Link>
        </>
      )}
    </div>
  );
}
