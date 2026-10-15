import { Link } from 'react-router-dom';
import { ResultRow } from '@/lib/electronicResults';

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function ResultTable({ rows, grouped }: { rows: ResultRow[]; grouped?: boolean }) {
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
