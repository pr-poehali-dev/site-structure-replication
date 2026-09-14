import { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateTime } from './utils';
import func2url from '../../../backend/func2url.json';

const BALANCE_URL = func2url['balance'];
const PROMO_CODES_URL = func2url['promo-codes'];
const POLL_ATTEMPTS = 5;
const POLL_DELAY_MS = 2000;

interface Transaction {
  id: number;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
}

const TYPE_LABELS: Record<string, { label: string; icon: string; className: string }> = {
  topup: { label: 'Пополнение', icon: 'ArrowDownCircle', className: 'text-green-600' },
  payment: { label: 'Списание', icon: 'ArrowUpCircle', className: 'text-red-500' },
  refund: { label: 'Возврат', icon: 'RotateCcw', className: 'text-secondary' },
  promo: { label: 'Промокод', icon: 'Gift', className: 'text-purple-600' },
};

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default function BalanceSection() {
  const { user, token } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('500');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoActivating, setPromoActivating] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [promoSuccess, setPromoSuccess] = useState('');

  const fetchBalance = useCallback(() => {
    if (!token) return;
    fetch(BALANCE_URL, { headers: { 'X-Auth-Token': token } })
      .then(r => r.json())
      .then(data => {
        setBalance(data.balance || 0);
        setTransactions(data.transactions || []);
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  useEffect(() => {
    const pendingRaw = localStorage.getItem('balance_pending_order');
    if (!pendingRaw || !token) return;
    localStorage.removeItem('balance_pending_order');
    setCheckingPayment(true);
    let cancelled = false;
    (async () => {
      for (let i = 0; i < POLL_ATTEMPTS; i++) {
        await sleep(POLL_DELAY_MS);
        if (cancelled) return;
        fetchBalance();
      }
      if (!cancelled) setCheckingPayment(false);
    })();
    return () => { cancelled = true; };
  }, [token, fetchBalance]);

  async function handleTopup(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user) return;
    const value = parseFloat(amount);
    if (!value || value < 1) {
      setError('Введите сумму пополнения');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(BALANCE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token },
        body: JSON.stringify({
          _action: 'topup',
          amount: value,
          user_email: user.email,
          user_name: [user.last_name, user.first_name].filter(Boolean).join(' '),
          return_url: window.location.origin + '/cabinet?tab=balance',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Не удалось создать платёж');
        return;
      }
      localStorage.setItem('balance_pending_order', data.order_number);
      window.location.href = data.payment_url;
    } catch {
      setError('Ошибка сети. Попробуйте ещё раз.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleActivatePromo(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !promoCode.trim()) return;
    setPromoActivating(true);
    setPromoError('');
    setPromoSuccess('');
    try {
      const res = await fetch(PROMO_CODES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token },
        body: JSON.stringify({ _action: 'activate', code: promoCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPromoError(data.error || 'Не удалось активировать промокод');
        return;
      }
      setPromoSuccess(`Баланс пополнен на ${data.amount.toLocaleString('ru')} ₽`);
      setPromoCode('');
      fetchBalance();
    } catch {
      setPromoError('Ошибка сети. Попробуйте ещё раз.');
    } finally {
      setPromoActivating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-primary rounded-2xl shadow-sm p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 chess-grid opacity-20" />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-white/70 text-sm mb-1">Текущий баланс</p>
            <p className="font-heading font-bold text-4xl">
              {loading ? <Icon name="Loader2" size={28} className="animate-spin inline" /> : `${balance.toLocaleString('ru')} ₽`}
            </p>
          </div>
          <Icon name="Wallet" size={40} className="text-secondary opacity-80" />
        </div>
      </div>

      {checkingPayment && (
        <div className="bg-orange-50 border border-orange-200 text-orange-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
          <Icon name="Loader2" size={15} className="animate-spin" /> Проверяем оплату, баланс обновится автоматически...
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-heading font-bold text-lg text-primary mb-4">Пополнить баланс</h3>
        <form onSubmit={handleTopup} className="flex flex-col gap-3 max-w-sm">
          <div className="grid grid-cols-4 gap-2">
            {[500, 1000, 2000, 5000].map(v => (
              <button
                type="button"
                key={v}
                onClick={() => setAmount(String(v))}
                className={`px-2 py-2 rounded-lg text-sm font-medium border transition-colors ${amount === String(v) ? 'bg-secondary text-secondary-foreground border-secondary' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
              >
                {v} ₽
              </button>
            ))}
          </div>
          <div className="relative">
            <input
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary pr-8"
              placeholder="Введите сумму"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₽</span>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button type="submit" disabled={submitting} className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold">
            {submitting ? <><Icon name="Loader2" size={16} className="mr-2 animate-spin" />Создаём платёж...</> : <><Icon name="CreditCard" size={16} className="mr-2" />Пополнить через ЮKassa</>}
          </Button>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-heading font-bold text-lg text-primary mb-4">Активировать промокод</h3>
        <form onSubmit={handleActivatePromo} className="flex gap-2 max-w-sm">
          <input
            type="text"
            value={promoCode}
            onChange={e => setPromoCode(e.target.value.toUpperCase())}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm uppercase tracking-wider font-mono focus:outline-none focus:ring-2 focus:ring-secondary"
            placeholder="Введите промокод"
          />
          <Button type="submit" disabled={promoActivating || !promoCode.trim()} variant="outline" className="shrink-0">
            {promoActivating ? <Icon name="Loader2" size={16} className="animate-spin" /> : <><Icon name="Gift" size={16} className="mr-2" />Активировать</>}
          </Button>
        </form>
        {promoError && <p className="text-red-500 text-sm mt-2">{promoError}</p>}
        {promoSuccess && <p className="text-green-600 text-sm mt-2">{promoSuccess}</p>}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-heading font-bold text-lg text-primary mb-4">История операций</h3>
        {loading ? (
          <div className="text-gray-400 py-6"><Icon name="Loader2" size={20} className="animate-spin inline mr-2" />Загрузка...</div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8 bg-muted/40 rounded-xl text-gray-400">
            <Icon name="Receipt" size={28} className="mx-auto mb-2 opacity-30" />
            <p>Операций пока не было</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {transactions.map(t => {
              const meta = TYPE_LABELS[t.type] || { label: t.type, icon: 'Circle', className: 'text-gray-500' };
              const isPositive = t.amount > 0;
              return (
                <div key={t.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon name={meta.icon} size={18} className={meta.className} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{t.description || meta.label}</p>
                      <p className="text-xs text-gray-400">{formatDateTime(t.created_at)}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold shrink-0 ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                    {isPositive ? '+' : ''}{t.amount.toLocaleString('ru')} ₽
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}