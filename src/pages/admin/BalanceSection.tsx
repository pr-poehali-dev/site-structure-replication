import { useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';
import func2url from '../../../backend/func2url.json';

const BALANCE_URL = func2url['balance'];

interface Stats {
  totals: { money: number; bonus: number; users_with_money: number; users_with_bonus: number; users_total: number };
  topups: { today: number; week: number; month: number; all: number; count: number };
  spent: number;
  bonus_flow: { earned: number; spent: number };
  daily: { date: string; amount: number }[];
  history: { id: number; amount: number; description: string | null; created_at: string; user_id: number; name: string; login: string }[];
}

const fmt = (n: number) => `${n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;

function Card({ icon, label, value, hint }: { icon: string; label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center gap-2 text-sm text-gray-500"><Icon name={icon} size={16} />{label}</div>
      <div className="mt-1 text-2xl font-bold text-primary">{value}</div>
      {hint && <div className="text-xs text-gray-400 mt-0.5">{hint}</div>}
    </div>
  );
}

export default function BalanceSection({ password }: { password: string }) {
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(BALANCE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ _action: 'admin_stats' }),
    })
      .then(r => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }, [password]);

  if (loading) return <div className="flex items-center gap-2 text-gray-500"><Icon name="Loader2" size={18} className="animate-spin" />Загрузка...</div>;
  if (!data) return <p className="text-gray-500">Не удалось загрузить данные</p>;

  const max = Math.max(...data.daily.map(d => d.amount), 1);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card icon="Wallet" label="Общий счёт участников" value={fmt(data.totals.money)} hint={`Есть деньги у ${data.totals.users_with_money} из ${data.totals.users_total}`} />
        <Card icon="Gift" label="Бонусные счета" value={fmt(data.totals.bonus)} hint={`Есть бонусы у ${data.totals.users_with_bonus}`} />
        <Card icon="ArrowDownToLine" label="Пополнено всего" value={fmt(data.topups.all)} hint={`Пополнений: ${data.topups.count}`} />
        <Card icon="ArrowUpFromLine" label="Потрачено участниками" value={fmt(data.spent)} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card icon="CalendarClock" label="Пополнено сегодня" value={fmt(data.topups.today)} />
        <Card icon="CalendarDays" label="За 7 дней" value={fmt(data.topups.week)} />
        <Card icon="CalendarRange" label="За 30 дней" value={fmt(data.topups.month)} />
        <Card icon="Sparkles" label="Бонусы: начислено / потрачено" value={`${fmt(data.bonus_flow.earned)} / ${fmt(data.bonus_flow.spent)}`} />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <p className="font-semibold text-primary mb-3">Пополнения за 30 дней</p>
        <div className="flex items-end gap-1 h-32">
          {data.daily.map(d => (
            <div key={d.date} className="flex-1 flex flex-col justify-end h-full" title={`${d.date}: ${fmt(d.amount)}`}>
              <div className="bg-secondary rounded-t min-h-[2px]" style={{ height: `${(d.amount / max) * 100}%`, opacity: d.amount ? 1 : 0.2 }} />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        <p className="font-semibold text-primary p-4 pb-2">История пополнений</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b bg-gray-50">
              <th className="py-2 px-4">Дата</th>
              <th className="px-4">Участник</th>
              <th className="px-4">Описание</th>
              <th className="px-4 text-right">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {data.history.length === 0 && (
              <tr><td colSpan={4} className="py-6 text-center text-gray-400">Пополнений пока нет</td></tr>
            )}
            {data.history.map(h => (
              <tr key={h.id} className="border-b border-gray-50 last:border-0">
                <td className="py-2 px-4 whitespace-nowrap">{new Date(h.created_at.replace(' ', 'T') + (h.created_at.includes('+') ? '' : 'Z')).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td className="px-4">{h.name}</td>
                <td className="px-4 text-gray-500">{h.description || '—'}</td>
                <td className="px-4 text-right font-semibold text-green-600">+{fmt(h.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
