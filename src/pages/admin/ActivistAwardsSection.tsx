import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { monthTitle } from '@/lib/activistCertificate';
import func2url from '../../../backend/func2url.json';

const URL_ = func2url['activist-awards'];

interface Player {
  user_id: number;
  last_name: string;
  first_name: string;
  institution: string | null;
  points: number;
  tournaments: number;
  rank: number;
}

const PLACES = [1, 2, 3] as const;
const PLACE_COLORS: Record<number, string> = {
  1: 'bg-amber-400 text-amber-950',
  2: 'bg-slate-300 text-slate-900',
  3: 'bg-orange-300 text-orange-950',
};

export default function ActivistAwardsSection({ password }: { password: string }) {
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [picks, setPicks] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (m?: string) => {
    setLoading(true);
    try {
      const res = await fetch(m ? `${URL_}?month=${m}` : URL_, { headers: { 'X-Admin-Password': password } });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error || 'Ошибка загрузки'); return; }
      setMonths(d.months);
      setMonth(d.month);
      setPlayers(d.players);
      const p: Record<number, number> = {};
      Object.entries(d.awarded as Record<string, number>).forEach(([uid, place]) => { p[Number(uid)] = place; });
      setPicks(p);
    } finally {
      setLoading(false);
    }
  }, [password]);

  useEffect(() => { load(); }, [load]);

  function setPlace(uid: number, place: number) {
    setPicks(p => {
      const next = { ...p };
      if (next[uid] === place) delete next[uid];
      else next[uid] = place;
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const awards: Record<string, number[]> = { '1': [], '2': [], '3': [] };
      Object.entries(picks).forEach(([uid, place]) => awards[String(place)].push(Number(uid)));
      const res = await fetch(URL_, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
        body: JSON.stringify({ month, awards }),
      });
      const d = await res.json();
      if (res.ok) toast.success(`Сохранено: ${d.saved}. Грамоты появились у участников в «Моих достижениях»`);
      else toast.error(d.error || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  }

  const counts = PLACES.map(p => Object.values(picks).filter(v => v === p).length);
  const mt = month ? monthTitle(month) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading font-bold text-xl text-primary flex items-center gap-2">
          <Icon name="Trophy" size={22} /> Активист месяца
        </h2>
        <div className="flex items-center gap-2">
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={month}
            onChange={e => load(e.target.value)}
          >
            {months.map(m => {
              const t = monthTitle(m);
              return <option key={m} value={m}>{t.genitive[0].toUpperCase() + t.genitive.slice(1)} {t.year}</option>;
            })}
          </select>
          <Button onClick={save} disabled={saving || !month}>
            {saving ? <Icon name="Loader2" size={14} className="animate-spin mr-1" /> : <Icon name="Save" size={14} className="mr-1" />}
            Сохранить
          </Button>
        </div>
      </div>

      <p className="text-sm text-gray-500">
        Рейтинг активности за выбранный месяц. На каждое место можно отметить нескольких участников: нажмите на цифру 1, 2 или 3 в строке.
        {mt && <> Выбрано: 1 место — {counts[0]}, 2 место — {counts[1]}, 3 место — {counts[2]}.</>}
      </p>

      {loading ? (
        <div className="text-gray-400 py-6"><Icon name="Loader2" size={20} className="animate-spin inline mr-2" />Загрузка...</div>
      ) : players.length === 0 ? (
        <div className="text-center py-10 bg-muted/40 rounded-xl text-gray-400">За этот месяц активности нет</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {players.map(p => (
            <div key={p.user_id} className={`flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0 ${picks[p.user_id] ? 'bg-blue-50/60' : ''}`}>
              <span className="w-8 text-center text-sm font-semibold text-gray-500">{p.rank}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{p.last_name} {p.first_name}</p>
                <p className="text-xs text-gray-400 truncate">{p.institution || ''}</p>
              </div>
              <div className="text-right text-sm shrink-0">
                <span className="font-bold text-primary">{p.points}</span>
                <span className="text-xs text-gray-400 ml-1">очк., турниров: {p.tournaments}</span>
              </div>
              <div className="flex gap-1 shrink-0">
                {PLACES.map(pl => (
                  <button
                    key={pl}
                    onClick={() => setPlace(p.user_id, pl)}
                    className={`w-8 h-8 rounded-full text-sm font-bold border transition-colors ${picks[p.user_id] === pl ? PLACE_COLORS[pl] + ' border-transparent' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'}`}
                    title={`${pl} место`}
                  >
                    {pl}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
