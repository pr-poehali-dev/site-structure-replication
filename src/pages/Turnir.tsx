import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Header, Footer } from '@/components/Layout';

const API_URL = 'https://functions.poehali.dev/7761fec6-18a2-49d2-833d-2b2db37f330d';
const APPS_URL = 'https://functions.poehali.dev/a5d82f30-fb42-49b2-8c5e-5baac7ded4fa';

interface Tournament {
  id: number;
  title: string;
  description: string;
  date: string | null;
  location: string;
  age_category: string;
  price: number | null;
  fsr_id: string;
  status: string;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function Turnir() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalTournament, setModalTournament] = useState<Tournament | null>(null);
  const [form, setForm] = useState({ fio: '', age: '', fsr_id: '', coach: '', country_city: '', school: '', email: '', phone: '', agree: false });
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    fetch(API_URL)
      .then(r => r.json())
      .then(data => setTournaments(data.tournaments || []))
      .finally(() => setLoading(false));
  }, []);

  function openModal(t: Tournament) {
    setModalTournament(t);
    setForm({ fio: '', age: '', fsr_id: '', coach: '', country_city: '', school: '', email: '', phone: '', agree: false });
    setSent(false);
  }

  function closeModal() {
    setModalTournament(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!modalTournament) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(APPS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: modalTournament.id,
          tournament_title: modalTournament.title,
          fio: form.fio,
          age: form.age,
          fsr_id: form.fsr_id,
          coach: form.coach,
          country_city: form.country_city,
          school: form.school,
          email: form.email,
          phone: form.phone,
        }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        setSubmitError('Ошибка при отправке. Попробуйте ещё раз.');
      }
    } catch {
      setSubmitError('Ошибка сети. Попробуйте ещё раз.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      {/* Hero */}
      <section className="bg-primary text-white py-12 px-4">
        <div className="container">
          <h1 className="font-heading font-bold text-4xl md:text-5xl uppercase">
            <span className="text-secondary">Турниры</span>
          </h1>
          <p className="mt-3 text-white/70 text-lg max-w-xl">Выберите турнир и подайте заявку на участие онлайн</p>
        </div>
      </section>

      {/* Tournaments */}
      <section className="container px-4 py-12">
        {loading ? (
          <div className="text-center py-20 text-gray-400">
            <Icon name="Loader" size={36} className="mx-auto mb-3 opacity-40 animate-spin" />
            <p>Загрузка турниров...</p>
          </div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Icon name="Swords" size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-xl font-medium">Турниров пока нет</p>
            <p className="mt-2 text-sm">Следите за обновлениями — скоро появятся новые соревнования</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments.map(t => {
              const isOpen = t.status !== 'closed';
              return (
              <div key={t.id} className={`bg-white rounded-2xl shadow-md border flex flex-col overflow-hidden transition-shadow ${isOpen ? 'border-gray-100 hover:shadow-lg' : 'border-gray-200 opacity-80'}`}>
                <div className={`px-6 py-5 border-b border-gray-100 ${isOpen ? 'bg-primary/5' : 'bg-gray-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-heading font-bold text-xl text-primary leading-tight">{t.title}</h2>
                    <span className={`shrink-0 text-xs px-2 py-1 rounded-full font-semibold ${isOpen ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {isOpen ? 'Приём открыт' : 'Приём закрыт'}
                    </span>
                  </div>
                  {t.date && (
                    <p className="mt-1 text-secondary font-semibold text-sm flex items-center gap-1">
                      <Icon name="Calendar" size={14} /> {formatDate(t.date)}
                    </p>
                  )}
                </div>
                <div className="px-6 py-4 flex-1 flex flex-col gap-3">
                  {t.description && <p className="text-gray-600 text-sm leading-relaxed">{t.description}</p>}
                  <div className="flex flex-col gap-1.5 text-sm text-gray-500 mt-auto">
                    {t.location && <span className="flex items-center gap-2"><Icon name="MapPin" size={14} className="text-secondary" />{t.location}</span>}
                    {t.age_category && <span className="flex items-center gap-2"><Icon name="Users" size={14} className="text-secondary" />{t.age_category}</span>}
                    {t.price && <span className="flex items-center gap-2"><Icon name="CreditCard" size={14} className="text-secondary" />Взнос: {t.price} ₽</span>}
                    {t.fsr_id && <span className="flex items-center gap-2"><Icon name="Hash" size={14} className="text-secondary" />ФШР: {t.fsr_id}</span>}
                  </div>
                </div>
                <div className="px-6 pb-5">
                  {isOpen ? (
                    <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold" onClick={() => openModal(t)}>
                      <Icon name="ClipboardCheck" size={16} className="mr-2" /> Подать заявку
                    </Button>
                  ) : (
                    <div className="w-full flex items-center justify-center gap-2 rounded-lg bg-gray-100 text-gray-400 font-semibold py-2.5 text-sm">
                      <Icon name="Lock" size={15} /> Приём заявок завершён
                    </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Modal */}
      {modalTournament && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" onClick={closeModal}>
              <Icon name="X" size={20} />
            </button>

            {!sent ? (
              <>
                <h2 className="font-heading font-bold text-xl text-primary mb-1">Заявка на участие</h2>
                <p className="text-sm text-gray-500 mb-4">{modalTournament.title}</p>
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">ФИО участника *</label>
                    <input required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary" placeholder="Иванов Иван Иванович" value={form.fio} onChange={e => setForm({ ...form, fio: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Возраст участника *</label>
                    <input required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary" placeholder="Например: 10 лет" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">ID ФШР</label>
                    <input className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary" placeholder="Номер в системе ФШР" value={form.fsr_id} onChange={e => setForm({ ...form, fsr_id: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">ФИО тренера</label>
                    <input className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary" placeholder="Петров Пётр Петрович" value={form.coach} onChange={e => setForm({ ...form, coach: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Страна / Город *</label>
                    <input required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary" placeholder="Россия, Москва" value={form.country_city} onChange={e => setForm({ ...form, country_city: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Учебное заведение</label>
                    <input className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary" placeholder="Шахматная школа / клуб" value={form.school} onChange={e => setForm({ ...form, school: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Электронная почта *</label>
                    <input required type="email" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary" placeholder="example@mail.ru" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Телефон представителя *</label>
                    <input required type="tel" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary" placeholder="+7 999 000 00 00" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer mt-1">
                    <input required type="checkbox" className="mt-0.5 accent-secondary w-4 h-4 shrink-0" checked={form.agree} onChange={e => setForm({ ...form, agree: e.target.checked })} />
                    <span className="text-sm text-gray-600">Соглашаюсь с условиями проведения соревнования</span>
                  </label>
                  {submitError && <p className="text-red-500 text-sm">{submitError}</p>}
                  <Button type="submit" disabled={submitting} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold mt-1">
                    <Icon name="CreditCard" size={16} className="mr-2" /> {submitting ? 'Отправка...' : 'Оплатить и подать заявку'}
                  </Button>
                </form>
              </>
            ) : (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon name="CheckCircle" size={32} className="text-green-500" />
                </div>
                <h2 className="font-heading font-bold text-xl text-primary mb-2">Заявка принята!</h2>
                <p className="text-gray-500 text-sm">Мы свяжемся с вами в ближайшее время для подтверждения участия.</p>
                <Button className="mt-6 w-full" variant="outline" onClick={closeModal}>Закрыть</Button>
              </div>
            )}
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}