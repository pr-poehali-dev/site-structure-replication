import { useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';
import func2url from '../../backend/func2url.json';

const URL = func2url['activity-rating'];

export default function ActivityBadge({ userId }: { userId: number | undefined }) {
  const [data, setData] = useState<{ points: number; place: number | null } | null>(null);

  useEffect(() => {
    if (!userId) return;
    fetch(`${URL}?user_id=${userId}`).then(r => r.json()).then(setData).catch(() => {});
  }, [userId]);

  if (!data) return null;

  return (
    <div className="w-full">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 text-left flex items-center gap-1">
        <Icon name="Flame" size={11} className="text-orange-500" /> Активность
      </p>
      <div className="flex gap-2">
        <div className="flex-1 bg-orange-50 rounded-lg px-2 py-2 text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Очки</p>
          <p className="font-heading font-bold text-sm text-primary">{data.points}</p>
        </div>
        <div className="flex-1 bg-orange-50 rounded-lg px-2 py-2 text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Место</p>
          <p className="font-heading font-bold text-sm text-primary">{data.place ?? '—'}</p>
        </div>
      </div>
    </div>
  );
}
