import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { SubscriptionPlan, Subscription, SUBSCRIPTIONS_URL } from './adminTypes';

interface SubscriptionPlansSectionProps {
  password: string;
  plans: SubscriptionPlan[];
  subscriptions: Subscription[];
  loading: boolean;
  fetchData: () => Promise<void>;
}

const EMPTY_PLAN_FORM = { id: null as number | null, title: '', participations: '', price: '', sort_order: '0' };

export default function SubscriptionPlansSection({ password, plans, subscriptions, loading, fetchData }: SubscriptionPlansSectionProps) {
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planForm, setPlanForm] = useState(EMPTY_PLAN_FORM);
  const [savingPlan, setSavingPlan] = useState(false);
  const [expandedSub, setExpandedSub] = useState<number | null>(null);

  function openCreatePlan() {
    setPlanForm(EMPTY_PLAN_FORM);
    setShowPlanForm(true);
  }

  function openEditPlan(p: SubscriptionPlan) {
    setPlanForm({ id: p.id, title: p.title, participations: String(p.participations), price: String(p.price), sort_order: String(p.sort_order) });
    setShowPlanForm(true);
  }

  async function handleSavePlan(e: React.FormEvent) {
    e.preventDefault();
    setSavingPlan(true);
    const action = planForm.id ? 'update_plan' : 'create_plan';
    const res = await fetch(SUBSCRIPTIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({
        _action: action, id: planForm.id,
        title: planForm.title, participations: Number(planForm.participations), price: Number(planForm.price), sort_order: Number(planForm.sort_order),
      }),
    });
    setSavingPlan(false);
    if (res.ok) {
      toast.success('Тариф сохранён');
      setShowPlanForm(false);
      fetchData();
    } else {
      toast.error('Не удалось сохранить тариф');
    }
  }

  async function handleTogglePlan(p: SubscriptionPlan) {
    await fetch(SUBSCRIPTIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ _action: 'set_plan_active', id: p.id, active: !p.is_active }),
    });
    fetchData();
  }

  async function handleDeletePlan(id: number) {
    if (!confirm('Удалить тариф?')) return;
    await fetch(SUBSCRIPTIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ _action: 'delete_plan', id }),
    });
    fetchData();
  }

  async function handleToggleSubActive(s: Subscription) {
    await fetch(SUBSCRIPTIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ _action: 'set_subscription_active', id: s.id, active: !s.active }),
    });
    fetchData();
  }

  async function handleDeleteSub(id: number) {
    if (!confirm('Удалить абонемент?')) return;
    await fetch(SUBSCRIPTIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ _action: 'delete_subscription', id }),
    });
    fetchData();
  }

  function subStatusInfo(s: Subscription): { label: string; color: string } {
    if (s.status === 'pending_payment') return { label: 'Ждёт оплаты', color: 'bg-orange-100 text-orange-700' };
    if (!s.active) return { label: 'Отключён', color: 'bg-red-100 text-red-700' };
    if (s.used_participations >= s.total_participations) return { label: 'Использован полностью', color: 'bg-gray-100 text-gray-600' };
    return { label: 'Активен', color: 'bg-green-100 text-green-700' };
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Icon name="Ticket" size={22} /> Абонементы
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchData()} disabled={loading}>
            <Icon name="RefreshCw" size={14} className={`mr-1 ${loading ? 'animate-spin' : ''}`} /> Обновить
          </Button>
          <Button size="sm" onClick={openCreatePlan}>
            <Icon name="Plus" size={14} className="mr-1" /> Новый тариф
          </Button>
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        Тарифы абонементов настраиваются здесь. Клиенты покупают абонемент на странице «Абонементы» на сайте, получают код и применяют его при подаче заявки на турнир вместо оплаты — пока не закончатся оплаченные участия.
      </p>

      {/* Тарифы */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Тарифы</h3>
        {loading ? (
          <div className="text-center py-8 text-gray-400">Загрузка...</div>
        ) : plans.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Icon name="Ticket" size={32} className="mx-auto mb-2 opacity-30" />
            <p>Тарифов пока нет</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {plans.map(p => (
              <div key={p.id} className="bg-white rounded-2xl shadow p-5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-primary">{p.title}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {p.is_active ? 'Активен' : 'Отключён'}
                  </span>
                </div>
                <div className="text-sm text-gray-500">{p.participations} участий · <span className="font-semibold text-primary">{p.price.toLocaleString('ru-RU')} ₽</span></div>
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" size="sm" onClick={() => openEditPlan(p)}><Icon name="Pencil" size={13} className="mr-1" /> Изменить</Button>
                  <Button variant="outline" size="sm" onClick={() => handleTogglePlan(p)}><Icon name={p.is_active ? 'Pause' : 'Play'} size={13} className="mr-1" /> {p.is_active ? 'Отключить' : 'Включить'}</Button>
                  <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50" onClick={() => handleDeletePlan(p.id)}><Icon name="Trash2" size={13} /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Купленные абонементы */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Проданные абонементы и их использование</h3>
        {loading ? (
          <div className="text-center py-8 text-gray-400">Загрузка...</div>
        ) : subscriptions.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Icon name="Ticket" size={40} className="mx-auto mb-3 opacity-30" />
            <p>Абонементов пока не куплено</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {subscriptions.map(s => {
              const st = subStatusInfo(s);
              const remaining = s.total_participations - s.used_participations;
              const isExpanded = expandedSub === s.id;
              return (
                <div key={s.id} className="bg-white rounded-2xl shadow p-5">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-mono font-bold text-lg text-primary tracking-wider">{s.code}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                        <span>{s.plan_title}</span>
                        <span className="font-medium text-primary">Осталось: {remaining} из {s.total_participations}</span>
                        <span>{s.price.toLocaleString('ru-RU')} ₽</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 mt-1">
                        {s.customer_name && <span>{s.customer_name}</span>}
                        {s.customer_email && <span>{s.customer_email}</span>}
                        {s.customer_phone && <span>{s.customer_phone}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {s.usages.length > 0 && (
                        <Button variant="outline" size="sm" onClick={() => setExpandedSub(isExpanded ? null : s.id)}>
                          <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={14} className="mr-1" /> История ({s.usages.length})
                        </Button>
                      )}
                      {s.status === 'paid' && (
                        <Button variant="outline" size="sm" onClick={() => handleToggleSubActive(s)}>
                          <Icon name={s.active ? 'Pause' : 'Play'} size={14} className="mr-1" /> {s.active ? 'Отключить' : 'Включить'}
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50" onClick={() => handleDeleteSub(s.id)}>
                        <Icon name="Trash2" size={14} />
                      </Button>
                    </div>
                  </div>
                  {isExpanded && s.usages.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col gap-2">
                      {s.usages.map((u, i) => (
                        <div key={i} className="text-sm bg-purple-50 text-purple-700 rounded-lg px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Icon name="User" size={14} />
                            {u.fio && <span className="font-medium">{u.fio}</span>}
                            {u.tournament_title && <span>— {u.tournament_title}</span>}
                          </div>
                          <span className="text-xs text-purple-500">{new Date(u.used_at).toLocaleString('ru-RU')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Модал создания/редактирования тарифа */}
      {showPlanForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setShowPlanForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-xl text-primary">{planForm.id ? 'Редактирование тарифа' : 'Новый тариф'}</h2>
              <button onClick={() => setShowPlanForm(false)} className="text-gray-400 hover:text-gray-600"><Icon name="X" size={20} /></button>
            </div>
            <form onSubmit={handleSavePlan} className="flex flex-col gap-3">
              <div><Label>Название *</Label><Input required className="mt-1" value={planForm.title} onChange={e => setPlanForm({ ...planForm, title: e.target.value })} placeholder="Например: 5 участий" /></div>
              <div><Label>Количество участий *</Label><Input required type="number" min="1" className="mt-1" value={planForm.participations} onChange={e => setPlanForm({ ...planForm, participations: e.target.value })} /></div>
              <div><Label>Цена, ₽ *</Label><Input required type="number" min="0" step="0.01" className="mt-1" value={planForm.price} onChange={e => setPlanForm({ ...planForm, price: e.target.value })} /></div>
              <div><Label>Порядок сортировки</Label><Input type="number" className="mt-1" value={planForm.sort_order} onChange={e => setPlanForm({ ...planForm, sort_order: e.target.value })} /></div>
              <div className="flex gap-2 mt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowPlanForm(false)}>Отмена</Button>
                <Button type="submit" className="flex-1" disabled={savingPlan}>{savingPlan ? 'Сохранение...' : 'Сохранить'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
