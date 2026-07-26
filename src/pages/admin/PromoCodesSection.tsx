import { Dispatch, SetStateAction, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { PromoCode, PROMO_CODES_URL } from './adminTypes';

interface PromoCodesSectionProps {
  password: string;
  promoCodes: PromoCode[];
  promoLoading: boolean;
  fetchPromoCodes: () => Promise<void>;
}

export default function PromoCodesSection({ password, promoCodes, promoLoading, fetchPromoCodes }: PromoCodesSectionProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [code, setCode] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch(PROMO_CODES_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ _action: 'create', code, expires_at: expiresAt || null }),
    });
    setCreating(false);
    if (res.ok) {
      const data = await res.json();
      toast.success(`Промокод создан: ${data.code}`);
      setShowCreate(false);
      setCode('');
      setExpiresAt('');
      fetchPromoCodes();
    } else {
      toast.error('Не удалось создать промокод. Возможно, такой код уже существует.');
    }
  }

  async function handleToggleActive(pc: PromoCode) {
    await fetch(PROMO_CODES_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ _action: 'set_active', id: pc.id, active: !pc.active }),
    });
    fetchPromoCodes();
  }

  async function handleDelete(id: number) {
    if (!confirm('Удалить промокод?')) return;
    await fetch(PROMO_CODES_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ _action: 'delete', id }),
    });
    fetchPromoCodes();
  }

  function statusInfo(pc: PromoCode): { label: string; color: string } {
    if (pc.used_at) return { label: 'Использован', color: 'bg-gray-100 text-gray-600' };
    if (!pc.active) return { label: 'Отключён', color: 'bg-red-100 text-red-700' };
    if (pc.expires_at && new Date(pc.expires_at) < new Date()) return { label: 'Истёк', color: 'bg-orange-100 text-orange-700' };
    return { label: 'Активен', color: 'bg-green-100 text-green-700' };
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Icon name="Gift" size={22} /> Промокоды
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchPromoCodes()} disabled={promoLoading}>
            <Icon name="RefreshCw" size={14} className={`mr-1 ${promoLoading ? 'animate-spin' : ''}`} /> Обновить
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Icon name="Plus" size={14} className="mr-1" /> Создать промокод
          </Button>
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        Промокод даёт бесплатное участие в любом платном турнире. Каждый код одноразовый — после применения он автоматически деактивируется.
      </p>

      {promoLoading ? <div className="text-center py-12 text-gray-400">Загрузка...</div>
        : promoCodes.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Icon name="Gift" size={40} className="mx-auto mb-3 opacity-30" />
            <p>Промокодов пока нет</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {promoCodes.map(pc => {
              const st = statusInfo(pc);
              return (
                <div key={pc.id} className="bg-white rounded-2xl shadow p-5 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-mono font-bold text-lg text-primary tracking-wider">{pc.code}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                      <span>Создан: {new Date(pc.created_at).toLocaleString('ru-RU')}</span>
                      {pc.expires_at && <span>Действует до: {new Date(pc.expires_at).toLocaleString('ru-RU')}</span>}
                      {pc.used_at && <span>Использован: {new Date(pc.used_at).toLocaleString('ru-RU')}</span>}
                    </div>
                    {pc.used_at && (pc.used_by_fio || pc.used_by_tournament_title) && (
                      <div className="mt-2 text-sm bg-purple-50 text-purple-700 rounded-lg px-3 py-2 flex items-center gap-2">
                        <Icon name="User" size={14} />
                        {pc.used_by_fio && <span className="font-medium">{pc.used_by_fio}</span>}
                        {pc.used_by_tournament_title && <span>— {pc.used_by_tournament_title}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {!pc.used_at && (
                      <Button variant="outline" size="sm" onClick={() => handleToggleActive(pc)}>
                        <Icon name={pc.active ? 'Pause' : 'Play'} size={14} className="mr-1" /> {pc.active ? 'Отключить' : 'Включить'}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50" onClick={() => handleDelete(pc.id)}>
                      <Icon name="Trash2" size={14} className="mr-1" /> Удалить
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-xl text-primary">Создать промокод</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><Icon name="X" size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <div>
                <Label>Код</Label>
                <Input className="mt-1 font-mono uppercase" placeholder="Оставьте пустым для автогенерации" value={code} onChange={e => setCode(e.target.value.toUpperCase())} />
              </div>
              <div>
                <Label>Срок действия (необязательно)</Label>
                <Input type="datetime-local" className="mt-1" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">Если не указать — промокод будет действовать бессрочно</p>
              </div>
              <div className="flex gap-2 mt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>Отмена</Button>
                <Button type="submit" className="flex-1" disabled={creating}>{creating ? 'Создание...' : 'Создать'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}