import { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { PushSubscription, PUSH_SUBSCRIPTIONS_LIST_URL } from './adminTypes';

interface SubscriptionsSectionProps {
  password: string;
  subs: PushSubscription[];
  subsLoading: boolean;
  setSubs: Dispatch<SetStateAction<PushSubscription[]>>;
  fetchSubs: () => Promise<void>;
}

export default function SubscriptionsSection({ password, subs, subsLoading, setSubs, fetchSubs }: SubscriptionsSectionProps) {
  async function handleDelete(id: number) {
    if (!confirm('Удалить подписку?')) return;
    await fetch(PUSH_SUBSCRIPTIONS_LIST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ _action: 'delete', id }),
    });
    setSubs(prev => prev.filter(s => s.id !== id));
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Icon name="Bell" size={22} /> Подписки на уведомления
        </h2>
        <Button variant="outline" size="sm" onClick={fetchSubs}>
          <Icon name="RefreshCw" size={14} className="mr-1" /> Обновить
        </Button>
      </div>

      {subsLoading ? (
        <div className="text-center py-12 text-gray-400">Загрузка...</div>
      ) : subs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Icon name="BellOff" size={40} className="mx-auto mb-3 opacity-30" />
          <p>Пока никто не подписался на уведомления о турнирах</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-500">Всего подписчиков: <b>{subs.length}</b></p>
          {subs.map(s => (
            <div key={s.id} className="bg-white rounded-2xl shadow p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-gray-700 truncate" title={s.endpoint}>{s.endpoint}</p>
                <p className="text-xs text-gray-400 mt-1">Подписался: {new Date(s.created_at).toLocaleString('ru-RU')}</p>
              </div>
              <Button variant="outline" size="sm" className="shrink-0 text-red-500 border-red-200 hover:bg-red-50" onClick={() => handleDelete(s.id)}>
                <Icon name="Trash2" size={14} className="mr-1" /> Удалить
              </Button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
