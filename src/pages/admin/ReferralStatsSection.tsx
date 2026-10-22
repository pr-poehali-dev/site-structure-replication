import { useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';
import func2url from '../../../backend/func2url.json';

const BALANCE_URL = func2url['balance'];

interface Stats {
  clicks: { total: number; unique: number; today: number; week: number; month: number };
  regs: { total: number; today: number; week: number; month: number; referrers: number };
  bonus: { payouts: number; total: number; paying_referrals: number };
  daily: { date: string; clicks: number; regs: number }[];
  top: { id: number; name: string; code: string; clicks: number; unique: number; regs: number; earned: number }[];
  recent: { id: number; name: string; created_at: string; referrer: string; bonus: number }[];
}

const money = (n: number) => `${n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%` : '—');

function Card({ icon, label, value, hint }: { icon: string; label: string; value: string | number; hint?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center gap-2 text-sm text-gray-500"><Icon name={icon} size={16} />{label}</div>
      <div className="mt-1 text-2xl font-bold text-primary">{value}</div>
      {hint && <div className="text-xs text-gray-400 mt-0.5">{hint}</div>}
    </div>
  );
}

export default function ReferralStatsSection({ password }: { password: string }) {
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(BALANCE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ _action: 'admin_ref_stats' }),
    })
      .then(r => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }, [password]);

  if (loading) return <div className="flex items-center gap-2 text-gray-500"><Icon name="Loader2" size={18} className="animate-spin" />Загрузка...</div>;
  if (!data) return <p className="text-gray-500">Не удалось загрузить данные</p>;

  const max = Math.max(...data.daily.map(d => d.clicks), ...data.daily.map(d => d.regs), 1);
  const fmtDate = (s: string) => new Date(s.replace(' ', 'T') + (s.includes('+') ? '' : 'Z')).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card icon="MousePointerClick" label="Переходов по ссылкам" value={data.clicks.total} hint={`Уникальных посетителей: ${data.clicks.unique}`} />
        <Card icon="UserPlus" label="Регистраций по ссылкам" value={data.regs.total} hint={`Конверсия в регистрацию: ${pct(data.regs.total, data.clicks.unique)}`} />
        <Card icon="Users" label="Приглашающих участников" value={data.regs.referrers} />
        <Card icon="Coins" label="Выплачено бонусов" value={money(data.bonus.total)} hint={`Начислений: ${data.bonus.payouts}, платящих приглашённых: ${data.bonus.paying_referrals}`} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card icon="CalendarClock" label="Переходы / регистрации сегодня" value={`${data.clicks.today} / ${data.regs.today}`} />
        <Card icon="CalendarDays" label="За 7 дней" value={`${data.clicks.week} / ${data.regs.week}`} />
        <Card icon="CalendarRange" label="За 30 дней" value={`${data.clicks.month} / ${data.regs.month}`} />
        <Card icon="Percent" label="Платящих среди приглашённых" value={pct(data.bonus.paying_referrals, data.regs.total)} />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="font-semibold text-primary">Переходы и регистрации за 30 дней</p>
          <div className="flex gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-secondary inline-block" />Переходы</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-primary inline-block" />Регистрации</span>
          </div>
        </div>
        <div className="flex items-end gap-1 h-32">
          {data.daily.map(d => (
            <div key={d.date} className="flex-1 flex items-end gap-px h-full" title={`${d.date}: переходов ${d.clicks}, регистраций ${d.regs}`}>
              <div className="flex-1 bg-secondary rounded-t min-h-[2px]" style={{ height: `${(d.clicks / max) * 100}%`, opacity: d.clicks ? 1 : 0.2 }} />
              <div className="flex-1 bg-primary rounded-t min-h-[2px]" style={{ height: `${(d.regs / max) * 100}%`, opacity: d.regs ? 1 : 0.2 }} />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        <p className="font-semibold text-primary p-4 pb-2">Кто приглашает</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b bg-gray-50">
              <th className="py-2 px-4">Участник</th>
              <th className="px-4">Код</th>
              <th className="px-4 text-right">Переходы</th>
              <th className="px-4 text-right">Уникальные</th>
              <th className="px-4 text-right">Регистрации</th>
              <th className="px-4 text-right">Конверсия</th>
              <th className="px-4 text-right">Заработано</th>
            </tr>
          </thead>
          <tbody>
            {data.top.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-gray-400">Данных пока нет</td></tr>}
            {data.top.map(r => (
              <tr key={r.id} className="border-b border-gray-50 last:border-0">
                <td className="py-2 px-4">{r.name}</td>
                <td className="px-4 text-gray-500 font-mono">{r.code}</td>
                <td className="px-4 text-right">{r.clicks}</td>
                <td className="px-4 text-right">{r.unique}</td>
                <td className="px-4 text-right font-semibold">{r.regs}</td>
                <td className="px-4 text-right">{pct(r.regs, r.unique)}</td>
                <td className="px-4 text-right font-semibold text-green-600">{money(r.earned)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        <p className="font-semibold text-primary p-4 pb-2">Последние приглашённые</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b bg-gray-50">
              <th className="py-2 px-4">Дата</th>
              <th className="px-4">Новый участник</th>
              <th className="px-4">Пригласил</th>
              <th className="px-4 text-right">Бонусов принёс</th>
            </tr>
          </thead>
          <tbody>
            {data.recent.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-gray-400">Приглашённых пока нет</td></tr>}
            {data.recent.map(r => (
              <tr key={r.id} className="border-b border-gray-50 last:border-0">
                <td className="py-2 px-4 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                <td className="px-4">{r.name}</td>
                <td className="px-4">{r.referrer}</td>
                <td className="px-4 text-right">{money(r.bonus)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
