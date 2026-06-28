import { useState, useEffect } from 'react';
import { Header, Footer } from '@/components/Layout';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import func2url from '../../backend/func2url.json';

interface Kit {
  id: string;
  title: string;
  description: string;
  composition: string[];
  price: number | null;
  icon: string;
  photo_url?: string | null;
}

interface Tournament {
  id: number;
  title: string;
  date: string | null;
}

interface CartItem {
  uid: string;
  kit: Kit;
  tournament: Tournament | null;
}

const ICON_MAP: Record<string, string> = {
  medal: 'Medal',
  trophy: 'Trophy',
  award: 'Award',
  star: 'Star',
};

export default function Kubki() {
  const [catalog, setCatalog] = useState<Kit[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [addingKit, setAddingKit] = useState<Kit | null>(null);
  const [selectedTournament, setSelectedTournament] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(func2url['award-catalog'])
      .then(r => r.json())
      .then(d => setCatalog(d.catalog || []));

    fetch(func2url['award-tournaments'])
      .then(r => r.json())
      .then(d => setTournaments(d.tournaments || []));
  }, []);

  const openAddKit = (kit: Kit) => {
    setAddingKit(kit);
    setSelectedTournament('');
  };

  const confirmAddKit = () => {
    if (!addingKit) return;
    const tournament = tournaments.find(t => String(t.id) === selectedTournament) || null;
    setCart(prev => [
      ...prev,
      { uid: Date.now() + Math.random() + '', kit: addingKit, tournament },
    ]);
    setAddingKit(null);
  };

  const removeItem = (uid: string) => {
    setCart(prev => prev.filter(i => i.uid !== uid));
  };

  const total = cart.reduce((sum, i) => sum + (i.kit.price || 0), 0);

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Заполните имя и телефон');
      return;
    }
    setSending(true);
    setError('');
    const items = cart.map(i => ({
      kit_id: i.kit.id,
      kit_title: i.kit.title,
      tournament_id: i.tournament?.id || null,
      tournament_title: i.tournament?.title || 'Не указан',
      price: i.kit.price,
    }));
    const res = await fetch(func2url['award-order'], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: form.name,
        customer_phone: form.phone,
        customer_email: form.email,
        notes: form.notes,
        items,
      }),
    });
    const data = await res.json();
    setSending(false);
    if (data.success) {
      setSuccess(true);
      setCart([]);
      setShowForm(false);
    } else {
      setError(data.error || 'Ошибка отправки');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      {/* Hero */}
      <section className="bg-primary text-white relative overflow-hidden">
        <div className="absolute inset-0 chess-grid opacity-40" />
        <div className="container relative px-4 py-10 md:py-14 max-w-5xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/15 text-secondary text-sm font-semibold mb-6">
            <Icon name="Award" size={15} /> Награды для победителей
          </span>
          <h1 className="font-heading font-bold text-4xl md:text-6xl uppercase leading-tight">
            Заказать <span className="text-secondary">награды</span>
          </h1>
          <p className="mt-5 text-white/75 text-lg max-w-2xl mx-auto">
            Заказать наградную атрибутику можно по результатам турниров и олимпиад центра «Мир шахмат» — на основании итоговых протоколов соревнований.
          </p>
        </div>
      </section>

      <section className="container px-4 py-12 max-w-5xl mx-auto">
        {success ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <Icon name="CheckCircle" size={36} className="text-green-600" />
            </div>
            <h2 className="font-heading text-2xl font-bold uppercase">Заявка принята!</h2>
            <p className="text-muted-foreground max-w-sm">Мы свяжемся с вами в ближайшее время для уточнения деталей заказа.</p>
            <Button onClick={() => setSuccess(false)} className="mt-4 bg-secondary text-secondary-foreground hover:bg-secondary/90">
              Сделать ещё заказ
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Каталог */}
            <div className="lg:col-span-2">
              <h2 className="font-heading text-2xl font-bold uppercase mb-6">Каталог комплектов</h2>
              {catalog.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-muted-foreground">
                  <Icon name="Loader2" size={24} className="animate-spin mr-2" /> Загрузка...
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {catalog.map(kit => (
                    <div key={kit.id} className="border border-border rounded-xl overflow-hidden flex flex-col bg-card hover:border-secondary transition-colors">
                      {kit.photo_url ? (
                        <img src={kit.photo_url} alt={kit.title} className="w-full object-contain bg-gray-50" />
                      ) : (
                        <div className="w-full h-72 bg-muted flex items-center justify-center">
                          <Icon name={ICON_MAP[kit.icon] || 'Award'} size={36} className="text-secondary/40" />
                        </div>
                      )}
                      <div className="p-5 flex flex-col gap-3 flex-1">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-secondary/15 flex items-center justify-center shrink-0">
                          <Icon name={ICON_MAP[kit.icon] || 'Award'} size={20} className="text-secondary" />
                        </div>
                        <div>
                          <div className="font-heading font-bold text-lg uppercase">{kit.title}</div>
                          <div className="text-sm text-muted-foreground">{kit.description}</div>
                        </div>
                      </div>
                      <ul className="text-sm text-muted-foreground space-y-1 border-t border-border pt-3">
                        {kit.composition.map((c, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Icon name="Check" size={14} className="text-secondary mt-0.5 shrink-0" />
                            {c}
                          </li>
                        ))}
                      </ul>
                      <div className="flex items-center justify-between mt-auto pt-3 border-t border-border">
                        <span className="font-bold text-lg">
                          {kit.price ? `${kit.price.toLocaleString('ru')} ₽` : 'По запросу'}
                        </span>
                        <Button size="sm" onClick={() => openAddKit(kit)} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                          <Icon name="Plus" size={14} className="mr-1" /> Добавить
                        </Button>
                      </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Корзина */}
            <div className="lg:col-span-1">
              <h2 className="font-heading text-2xl font-bold uppercase mb-6">Ваш заказ</h2>
              <div className="border border-border rounded-xl p-5 bg-card sticky top-4">
                {cart.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Icon name="ShoppingCart" size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Добавьте комплект из каталога</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map(item => (
                      <div key={item.uid} className="flex items-start gap-2 border-b border-border pb-3 last:border-0">
                        <Icon name={ICON_MAP[item.kit.icon] || 'Award'} size={16} className="text-secondary mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm">{item.kit.title}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {item.tournament ? item.tournament.title : 'Турнир не выбран'}
                          </div>
                          <div className="text-xs font-medium mt-0.5">
                            {item.kit.price ? `${item.kit.price.toLocaleString('ru')} ₽` : 'По запросу'}
                          </div>
                        </div>
                        <button onClick={() => removeItem(item.uid)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <Icon name="X" size={14} />
                        </button>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold pt-1">
                      <span>Итого:</span>
                      <span>{total > 0 ? `${total.toLocaleString('ru')} ₽` : 'По запросу'}</span>
                    </div>
                    <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90" onClick={() => setShowForm(true)}>
                      Оформить заявку
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Модал: выбор турнира */}
      {addingKit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-xl uppercase">Выберите турнир</h3>
              <button onClick={() => setAddingKit(null)} className="text-muted-foreground hover:text-foreground">
                <Icon name="X" size={20} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Комплект <strong>{addingKit.title}</strong> — для какого турнира или олимпиады?
            </p>
            <select
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background mb-4"
              value={selectedTournament}
              onChange={e => setSelectedTournament(e.target.value)}
            >
              <option value="">— Выберите турнир —</option>
              {tournaments.map(t => (
                <option key={t.id} value={String(t.id)}>
                  {t.title}{t.date ? ` (${new Date(t.date).toLocaleDateString('ru')})` : ''}
                </option>
              ))}
            </select>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setAddingKit(null)}>Отмена</Button>
              <Button className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/90" onClick={confirmAddKit}>
                Добавить в заказ
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Модал: форма заявки */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-xl uppercase">Контактные данные</h3>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                <Icon name="X" size={20} />
              </button>
            </div>
            <div className="space-y-3 mb-4">
              <input
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                placeholder="Ваше имя *"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
              <input
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                placeholder="Телефон *"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              />
              <input
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                placeholder="Email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
              <textarea
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none"
                placeholder="Комментарий к заказу"
                rows={3}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
            {error && <p className="text-sm text-destructive mb-3">{error}</p>}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Назад</Button>
              <Button
                className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/90"
                onClick={handleSubmit}
                disabled={sending}
              >
                {sending ? <Icon name="Loader2" size={16} className="animate-spin mr-2" /> : null}
                Отправить заявку
              </Button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}