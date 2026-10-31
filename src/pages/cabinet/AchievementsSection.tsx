import { useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { renderActivistCertificate, monthTitle } from '@/lib/activistCertificate';
import { downloadBlob } from '@/lib/diploma';
import func2url from '../../../backend/func2url.json';

const ACTIVIST_URL = func2url['activist-awards'];

interface Award {
  month: string;
  place: number;
  points: number;
  tournaments: number;
}

const PLACE_STYLE: Record<number, string> = {
  1: 'from-yellow-100 to-amber-50 border-amber-300',
  2: 'from-slate-100 to-gray-50 border-slate-300',
  3: 'from-orange-100 to-amber-50 border-orange-300',
};

export default function AchievementsSection() {
  const { user, token } = useAuth();
  const [awards, setAwards] = useState<Award[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(ACTIVIST_URL, { headers: { 'X-Auth-Token': token } })
      .then(r => r.json())
      .then(d => setAwards(d.awards || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function download(a: Award) {
    if (!user) return;
    setBusy(a.month);
    try {
      const fio = `${user.last_name} ${user.first_name}`;
      const blob = await renderActivistCertificate({ fio, month: a.month, place: a.place, points: a.points });
      downloadBlob(blob, `Грамота Активист месяца ${a.month} - ${fio}.png`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось создать грамоту');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
      <h2 className="font-heading font-bold text-xl text-primary mb-1 flex items-center gap-2">
        <Icon name="Trophy" size={22} /> Мои достижения
      </h2>
      <p className="text-sm text-gray-500 mb-5">Награды и грамоты, которые вы получили на платформе.</p>

      {loading ? (
        <div className="text-gray-400 py-6"><Icon name="Loader2" size={20} className="animate-spin inline mr-2" />Загрузка...</div>
      ) : awards.length === 0 ? (
        <div className="text-center py-10 bg-muted/40 rounded-xl text-gray-500">
          <Icon name="Award" size={40} className="mx-auto mb-3 opacity-30" />
          <p>Пока достижений нет. Участвуйте в турнирах и набирайте очки активности!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {awards.map(a => {
            const mt = monthTitle(a.month);
            return (
              <div key={a.month} className={`rounded-xl border bg-gradient-to-br p-4 flex flex-col gap-3 ${PLACE_STYLE[a.place] || PLACE_STYLE[3]}`}>
                <div className="flex items-center gap-3">
                  <img src={['', '/medals/medal-gold-v2.png', '/medals/medal-silver-v2.png', '/medals/medal-bronze-v2.png'][a.place]} alt="" className="w-14 h-14 object-contain" />
                  <div>
                    <p className="font-heading font-bold text-primary">Активист {mt.genitive}</p>
                    <p className="text-sm text-gray-600">{a.place} место, {mt.year} год</p>
                    <p className="text-xs text-gray-500">Очков активности: {a.points}</p>
                  </div>
                </div>
                <Button size="sm" onClick={() => download(a)} disabled={busy === a.month}>
                  {busy === a.month ? <Icon name="Loader2" size={14} className="animate-spin mr-1" /> : <Icon name="Download" size={14} className="mr-1" />}
                  Скачать грамоту
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
