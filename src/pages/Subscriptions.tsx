import { useState, useEffect } from 'react';
import { Header, Footer } from '@/components/Layout';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Seo from '@/components/Seo';
import func2url from '../../backend/func2url.json';
import { useYookassa, openPaymentPage } from '@/components/extensions/yookassa/useYookassa';

interface Plan {
  id: number;
  title: string;
  participations: number;
  price: number;
}

export default function Subscriptions() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [error, setError] = useState('');

  const { createPayment, isLoading: paying } = useYookassa({
    apiUrl: func2url['yookassa-yookassa'],
    onError: (err) => setError(err.message),
  });

  useEffect(() => {
    fetch(`${func2url['subscriptions']}?scope=plans`)
      .then(r => r.json())
      .then(d => setPlans(d.plans || []))
      .finally(() => setLoading(false));
  }, []);

  function openBuy(plan: Plan) {
    setSelectedPlan(plan);
    setForm({ name: '', email: '', phone: '' });
    setError('');
  }

  async function handleBuy(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPlan) return;
    if (!form.name.trim()) { setError('Укажите ФИО'); return; }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('Укажите корректный email — на него придёт чек и код абонемента');
      return;
    }
    setError('');
    const payment = await createPayment({
      amount: selectedPlan.price,
      userName: form.name,
      userEmail: form.email,
      userPhone: form.phone,
      description: `Абонемент «${selectedPlan.title}»`,
      orderType: 'subscription',
      itemsData: { plan_id: selectedPlan.id, plan_title: selectedPlan.title, participations: selectedPlan.participations },
      cartItems: [{ id: String(selectedPlan.id), name: selectedPlan.title, price: selectedPlan.price, quantity: 1 }],
      returnUrl: window.location.origin + '/order-status',
    });
    if (payment?.payment_url) {
      openPaymentPage(payment.payment_url);
    } else {
      setError('Не удалось создать платёж. Попробуйте ещё раз.');
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Seo
        title="Абонементы на участие в турнирах"
        description="Купите абонемент на несколько участий в шахматных турнирах со скидкой. Один код — несколько заявок."
        path="/subscriptions"
      />
      <Header />

      <section className="bg-primary text-white relative overflow-hidden">
        <div className="absolute inset-0 chess-grid opacity-40" />
        <div className="container relative px-4 py-10 md:py-14 max-w-4xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/15 text-secondary text-sm font-semibold mb-6">
            <Icon name="Ticket" size={15} /> Выгоднее по одному
          </span>
          <h1 className="font-heading font-bold text-4xl md:text-6xl uppercase leading-tight">
            <span className="text-secondary">Абонементы</span>
          </h1>
          <p className="mt-5 text-white/75 text-lg max-w-2xl mx-auto">
            Купите пакет участий сразу и экономьте — код абонемента можно применять при подаче заявки на любой платный турнир
          </p>
        </div>
      </section>

      <section className="container px-4 py-12 max-w-4xl mx-auto">
        {loading ? (
          <div className="text-center py-20 text-gray-400">
            <Icon name="Loader" size={36} className="mx-auto mb-3 opacity-40 animate-spin" />
            <p>Загрузка тарифов...</p>
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Icon name="Ticket" size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-xl font-medium">Абонементы пока недоступны</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-6">
            {plans.map(p => {
              const perOne = p.price / p.participations;
              return (
                <div key={p.id} className="bg-white rounded-2xl shadow-md border border-gray-100 p-7 flex flex-col">
                  <div className="w-12 h-12 rounded-xl bg-secondary/15 flex items-center justify-center mb-4">
                    <Icon name="Ticket" size={24} className="text-secondary" />
                  </div>
                  <h2 className="font-heading font-bold text-2xl text-primary mb-1">{p.title}</h2>
                  <p className="text-sm text-gray-500 mb-5">{p.participations} участ{p.participations === 1 ? 'ие' : p.participations < 5 ? 'ия' : 'ий'} в платных турнирах</p>
                  <div className="mb-6">
                    <span className="font-heading font-bold text-4xl text-primary">{p.price.toLocaleString('ru-RU')} ₽</span>
                    <p className="text-xs text-gray-400 mt-1">≈ {Math.round(perOne)} ₽ за одно участие</p>
                  </div>
                  <Button className="mt-auto bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold" onClick={() => openBuy(p)}>
                    <Icon name="ShoppingCart" size={16} className="mr-2" /> Купить абонемент
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-10 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-heading font-bold text-lg text-primary mb-3 flex items-center gap-2">
            <Icon name="Info" size={18} /> Как это работает
          </h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2"><Icon name="Check" size={16} className="text-secondary shrink-0 mt-0.5" /> Оплатите абонемент — на почту придёт уникальный код</li>
            <li className="flex items-start gap-2"><Icon name="Check" size={16} className="text-secondary shrink-0 mt-0.5" /> При подаче заявки на платный турнир введите этот код вместо оплаты</li>
            <li className="flex items-start gap-2"><Icon name="Check" size={16} className="text-secondary shrink-0 mt-0.5" /> Код можно использовать несколько раз — пока не закончатся участия</li>
            <li className="flex items-start gap-2"><Icon name="Check" size={16} className="text-secondary shrink-0 mt-0.5" /> Абонемент действует для одного участника на разные турниры</li>
          </ul>
        </div>
      </section>

      {/* Модал покупки */}
      {selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setSelectedPlan(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-xl text-primary">Покупка абонемента</h2>
              <button onClick={() => setSelectedPlan(null)} className="text-gray-400 hover:text-gray-600"><Icon name="X" size={20} /></button>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
              <span className="font-medium text-gray-700">{selectedPlan.title}</span>
              <span className="font-bold text-primary">{selectedPlan.price.toLocaleString('ru-RU')} ₽</span>
            </div>
            <form onSubmit={handleBuy} className="flex flex-col gap-3">
              <div><Label>ФИО *</Label><Input required className="mt-1" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Email *</Label><Input type="email" required className="mt-1" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Код абонемента придёт на эту почту" /></div>
              <div><Label>Телефон</Label><Input className="mt-1" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex gap-2 mt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setSelectedPlan(null)}>Отмена</Button>
                <Button type="submit" className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/90" disabled={paying}>
                  {paying ? 'Переход к оплате...' : 'Оплатить'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
