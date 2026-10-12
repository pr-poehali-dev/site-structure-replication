import { useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from './utils';
import func2url from '../../../backend/func2url.json';

const BALANCE_URL = func2url['balance'];

interface Referral {
  id: number;
  name: string;
  login: string | null;
  created_at: string;
  earned: number;
}

export default function ReferralsSection() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!token) return;
    fetch(`${BALANCE_URL}?scope=referrals`, { headers: { 'X-Auth-Token': token } })
      .then(r => r.json())
      .then(data => {
        setCode(data.referral_code || '');
        setReferrals(data.referrals || []);
        setTotal(data.total_earned || 0);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const link = code ? `${window.location.origin}/register?ref=${code}` : '';

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Ссылка скопирована');
    } catch {
      toast.error('Не удалось скопировать ссылку');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-heading font-bold text-lg text-primary mb-1 flex items-center gap-2">
          <Icon name="Users" size={20} className="text-secondary" /> Список приглашённых мною
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          Отправьте ссылку друзьям. За каждое пополнение баланса приглашённым вы получите 25% от суммы бонусами.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            readOnly
            value={loading ? 'Загрузка...' : link}
            onFocus={e => e.currentTarget.select()}
            className="flex-1 min-w-0 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
          />
          <Button onClick={copyLink} disabled={!link} className="shrink-0">
            <Icon name="Copy" size={15} className="mr-2" /> Скопировать
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap border-b border-gray-50">
          <p className="text-sm text-gray-500">Приглашено: <span className="font-semibold text-primary">{referrals.length}</span></p>
          <p className="text-sm text-gray-500">
            Заработано бонусов: <span className="font-semibold text-purple-700">{total.toLocaleString('ru')} ₽</span>
          </p>
        </div>
        {loading ? (
          <div className="text-gray-400 py-10 text-center"><Icon name="Loader2" size={20} className="animate-spin inline mr-2" />Загрузка...</div>
        ) : referrals.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Icon name="Users" size={32} className="mx-auto mb-2 opacity-30" />
            <p>Пока никто не зарегистрировался по вашей ссылке</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-gray-50">
            {referrals.map(r => (
              <div key={r.id} className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-medium text-gray-800">{r.name}{r.login ? <span className="text-gray-400 font-normal"> · {r.login}</span> : null}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Зарегистрирован: {formatDate(r.created_at)}</p>
                </div>
                <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${r.earned > 0 ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
                  {r.earned > 0 ? '+' : ''}{r.earned.toLocaleString('ru')} ₽
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
