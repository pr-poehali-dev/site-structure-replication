import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { ActivityLog, OnlineStatus, USER_LOGS_URL } from './adminTypes';

interface LogsSectionProps {
  password: string;
}

const EVENT_ICONS: Record<string, string> = {
  register: 'UserPlus',
  login: 'LogIn',
  logout: 'LogOut',
  hall_enter: 'Swords',
};

const EVENT_COLORS: Record<string, string> = {
  register: 'bg-purple-100 text-purple-700',
  login: 'bg-green-100 text-green-700',
  logout: 'bg-gray-100 text-gray-600',
  hall_enter: 'bg-blue-100 text-blue-700',
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso + 'Z').getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн назад`;
}

export default function LogsSection({ password }: LogsSectionProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [online, setOnline] = useState<OnlineStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchLogs = useCallback(async (q = '') => {
    setLoading(true);
    const url = q ? `${USER_LOGS_URL}?search=${encodeURIComponent(q)}` : USER_LOGS_URL;
    const res = await fetch(url, { headers: { 'X-Admin-Password': password } });
    const data = await res.json();
    setLogs(data.logs || []);
    setOnline(data.online_status || []);
    setLoading(false);
  }, [password]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchLogs(search);
  }

  const onlineNow = online.filter(o => o.is_online);

  return (
    <>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Icon name="ScrollText" size={22} /> Логи
        </h2>
        <Button variant="outline" size="sm" onClick={() => fetchLogs(search)}>
          <Icon name="RefreshCw" size={14} className="mr-1" /> Обновить
        </Button>
      </div>

      <div className="bg-white rounded-2xl shadow p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <h3 className="font-semibold text-primary">Сейчас онлайн ({onlineNow.length})</h3>
        </div>
        {onlineNow.length === 0 ? (
          <p className="text-sm text-gray-400">Никого нет на сайте</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {onlineNow.map(o => (
              <div key={o.user_id} className="bg-green-50 border border-green-100 rounded-lg px-3 py-1.5 text-sm">
                <span className="font-medium text-gray-700">{o.fio}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <Input placeholder="Поиск по имени или email..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
        <Button type="submit" variant="outline" size="sm">
          <Icon name="Search" size={14} className="mr-1" /> Найти
        </Button>
        {search && (
          <Button type="button" variant="ghost" size="sm" onClick={() => { setSearch(''); fetchLogs(''); }}>
            Сбросить
          </Button>
        )}
      </form>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Загрузка...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Icon name="ScrollText" size={40} className="mx-auto mb-3 opacity-30" />
          <p>Событий пока нет</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {logs.map(l => {
            const onlineEntry = online.find(o => o.user_id === l.user_id);
            return (
              <div key={l.id} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3 flex-wrap">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${EVENT_COLORS[l.event_type] || 'bg-gray-100 text-gray-600'}`}>
                  <Icon name={EVENT_ICONS[l.event_type] || 'Activity'} size={16} />
                </div>
                <div className="flex-1 min-w-[180px]">
                  <p className="text-sm font-medium text-gray-800">
                    {l.fio}
                    {onlineEntry?.is_online && <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-green-500 align-middle" title="Онлайн" />}
                  </p>
                  <p className="text-xs text-gray-400">{l.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${EVENT_COLORS[l.event_type] || 'bg-gray-100 text-gray-600'}`}>
                    {l.event_label}
                  </span>
                  {typeof l.meta?.tournament_title === 'string' && (
                    <span className="text-xs text-gray-500">{l.meta.tournament_title}</span>
                  )}
                </div>
                <div className="text-xs text-gray-400 shrink-0 ml-auto text-right">
                  <p>{timeAgo(l.created_at)}</p>
                  <p>{new Date(l.created_at + 'Z').toLocaleString('ru-RU')}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
