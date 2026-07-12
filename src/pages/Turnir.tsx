import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Header, Footer } from '@/components/Layout';
import { useYookassa, openPaymentPage } from '@/components/extensions/yookassa/useYookassa';
import PublicPushSubscribe from '@/components/PublicPushSubscribe';

const API_URL = 'https://functions.poehali.dev/7761fec6-18a2-49d2-833d-2b2db37f330d';
const APPS_URL = 'https://functions.poehali.dev/a5d82f30-fb42-49b2-8c5e-5baac7ded4fa';
const YOOKASSA_URL = 'https://functions.poehali.dev/6e82b6ca-7ab9-4c14-b655-024798e28cc1';

interface Tournament {
  id: number;
  title: string;
  description: string;
  date: string | null;
  location: string;
  age_category: string;
  price: number | null;
  time_control: string;
  time_msk: string;
  status: string;
  diploma_sample_url: string | null;
  regulation_url: string | null;
  announcement_url: string | null;
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

  const { createPayment, isLoading: paymentLoading } = useYookassa({
    apiUrl: YOOKASSA_URL,
    onError: (err) => setSubmitError(err.message),
  });

  // Модал списка участников
  const [participantsModal, setParticipantsModal] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<{fio: string; age: string}[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);

  // Модал просмотра изображения (анонс / образец диплома)
  const [imagePreview, setImagePreview] = useState<{ url: string; title: string } | null>(null);

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

  async function openParticipants(t: Tournament) {
    setParticipantsModal(t);
    setParticipantsLoading(true);
    setParticipants([]);
    const res = await fetch(`${APPS_URL}?tournament_id=${t.id}`);
    const data = await res.json();
    setParticipants(data.participants || []);
    setParticipantsLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!modalTournament) return;
    setSubmitting(true);
    setSubmitError('');
    const isPaid = !!(modalTournament.price && modalTournament.price > 0);
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
          requires_payment: isPaid,
        }),
      });
      if (!res.ok) {
        setSubmitError('Ошибка при отправке. Попробуйте ещё раз.');
        return;
      }
      const data = await res.json();
      const applicationId = data.id;

      if (isPaid) {
        const payment = await createPayment({
          amount: modalTournament.price as number,
          userName: form.fio,
          userEmail: form.email,
          userPhone: form.phone,
          description: `Турнир: ${modalTournament.title}`,
          cartItems: [{ id: String(modalTournament.id), name: modalTournament.title, price: modalTournament.price as number, quantity: 1 }],
          returnUrl: window.location.origin + '/order-status',
          applicationId,
        });
        if (payment?.payment_url) {
          openPaymentPage(payment.payment_url);
        } else {
          setSubmitError('Не удалось создать платёж. Попробуйте ещё раз.');
        }
      } else {
        setSent(true);
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
      <section className="bg-primary text-white relative overflow-hidden">
        <div className="absolute inset-0 chess-grid opacity-40" />
        <div className="container relative px-4 py-10 md:py-14 max-w-4xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/15 text-secondary text-sm font-semibold mb-6">
            <Icon name="Trophy" size={15} /> Онлайн-регистрация
          </span>
          <h1 className="font-heading font-bold text-4xl md:text-6xl uppercase leading-tight">
            <span className="text-secondary">Турниры</span>
          </h1>
          <p className="mt-5 text-white/75 text-lg max-w-2xl mx-auto">
            Выберите турнир и подайте заявку на участие онлайн
          </p>
          <div className="mt-6 flex justify-center">
            <PublicPushSubscribe />
          </div>
        </div>
      </section>

      {/* Tournaments + Правила */}
      <section className="container px-4 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Список турниров */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-3 mb-7">
            <h2 className="font-heading font-bold text-2xl md:text-3xl text-primary uppercase shrink-0">Список турниров</h2>
            <div className="h-px flex-1 bg-border" />
          </div>
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
            <div className="flex flex-col gap-6">
              {tournaments.map(t => {
                const isOpen = t.status !== 'closed';
                const hasPreviews = !!(t.announcement_url || t.diploma_sample_url);
                return (
                <div key={t.id} className={`bg-white rounded-2xl shadow-md border flex flex-col md:flex-row overflow-hidden transition-shadow ${isOpen ? 'border-gray-100 hover:shadow-lg' : 'border-gray-200 opacity-80'}`}>
                  <div className="flex-1 flex flex-col min-w-0">
                    <div className={`px-6 py-5 border-b border-gray-100 ${isOpen ? 'bg-primary/5' : 'bg-gray-50'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="font-heading font-bold text-xl text-primary leading-tight">{t.title}</h2>
                        <span className={`shrink-0 text-xs px-2 py-1 rounded-full font-semibold ${isOpen ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                          {isOpen ? 'Приём открыт' : 'Приём закрыт'}
                        </span>
                      </div>
                      {t.date && (
                        <p className="mt-1 text-secondary font-semibold text-sm flex items-center gap-1">
                          <Icon name="Calendar" size={14} /> {formatDate(t.date)}{t.time_msk && `, ${t.time_msk} МСК`}
                        </p>
                      )}
                    </div>
                    <div className="px-6 py-4 flex-1 flex flex-col gap-3">
                      {t.description && <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{t.description}</p>}
                      <div className="flex flex-col gap-1.5 text-sm text-gray-500 mt-auto">
                        {t.location && <span className="flex items-center gap-2"><Icon name="MapPin" size={14} className="text-secondary" />{t.location}</span>}
                        {t.age_category && <span className="flex items-center gap-2"><Icon name="Users" size={14} className="text-secondary" />{t.age_category}</span>}
                        {t.price && <span className="flex items-center gap-2"><Icon name="CreditCard" size={14} className="text-secondary" />Взнос: {t.price} ₽</span>}
                        {t.time_control && <span className="flex items-center gap-2"><Icon name="Timer" size={14} className="text-secondary" />Контроль времени: {t.time_control}</span>}
                        {t.regulation_url && (
                          <a href={t.regulation_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-medium text-primary hover:underline">
                            <Icon name="ScrollText" size={14} /> Положение (PDF)
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="px-6 pb-5 flex flex-col sm:flex-row gap-2">
                      {isOpen ? (
                        <Button className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold" onClick={() => openModal(t)}>
                          <Icon name="ClipboardCheck" size={16} className="mr-2" /> Подать заявку
                        </Button>
                      ) : (
                        <div className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-gray-100 text-gray-400 font-semibold py-2.5 text-sm">
                          <Icon name="Lock" size={15} /> Приём заявок завершён
                        </div>
                      )}
                      <Button variant="outline" className="flex-1 text-primary border-primary/30 hover:bg-primary/5" onClick={() => openParticipants(t)}>
                        <Icon name="Users" size={16} className="mr-2" /> Список участников
                      </Button>
                    </div>
                  </div>

                  {hasPreviews && (
                    <div className="flex flex-row md:flex-col gap-4 p-4 md:w-64 shrink-0 bg-gray-50 border-t md:border-t-0 md:border-l border-gray-100">
                      {t.announcement_url && (
                        <button type="button" onClick={() => setImagePreview({ url: t.announcement_url as string, title: `Анонс — ${t.title}` })} className="flex-1 flex flex-col gap-1.5 group text-left">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Анонс</span>
                          <div className="flex-1 min-h-32 bg-white rounded-lg border border-gray-200 flex items-center justify-center p-1.5 group-hover:border-secondary/50 transition-colors cursor-zoom-in">
                            <img src={t.announcement_url} alt={`Анонс турнира: ${t.title}`} className="max-w-full max-h-40 object-contain" />
                          </div>
                        </button>
                      )}
                      {t.diploma_sample_url && (
                        <button type="button" onClick={() => setImagePreview({ url: t.diploma_sample_url as string, title: `Образец диплома — ${t.title}` })} className="flex-1 flex flex-col gap-1.5 group text-left">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Образец диплома</span>
                          <div className="flex-1 min-h-32 bg-white rounded-lg border border-gray-200 flex items-center justify-center p-1.5 group-hover:border-secondary/50 transition-colors cursor-zoom-in">
                            <img src={t.diploma_sample_url} alt={`Образец диплома турнира: ${t.title}`} className="max-w-full max-h-40 object-contain" />
                          </div>
                        </button>
                      )}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Правила и регламент */}
        <div className="lg:col-span-1 lg:sticky lg:top-6">
          <div className="rounded-xl border border-border bg-muted/40 px-5 py-4 md:px-6 md:py-5">
            <div className="flex items-center gap-2.5 mb-4">
              <Icon name="ScrollText" size={16} className="text-secondary shrink-0" />
              <h2 className="font-heading font-semibold text-sm md:text-base text-primary uppercase tracking-wide">Правила и регламент участия</h2>
            </div>

            <div className="flex flex-col gap-4 text-xs md:text-[13px] text-muted-foreground leading-relaxed">
              <div>
                <h3 className="font-semibold text-foreground/80 flex items-center gap-1.5 mb-1"><Icon name="Monitor" size={13} className="text-secondary" /> Формат проведения</h3>
                <p>Турниры проводятся онлайн на платформе Lichess.org по швейцарской системе. Количество туров зависит от числа участников (максимум 7).  Жеребьёвка каждого тура выполняется автоматически средствами платформы.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground/80 flex items-center gap-1.5 mb-1"><Icon name="Users" size={13} className="text-secondary" /> Участники и группы</h3>
                <p>К участию допускаются дети, зарегистрированные на Lichess.org. Перед участием каждый ребенок должен вступить в клуб <a href="https://lichess.org/team/weMlgSjB" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">«Мир шахмат»</a> на площадке lichess.org. Участники делятся на группы по рейтингу ФШР и возрасту — количество подгрупп зависит от общего числа заявок.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground/80 flex items-center gap-1.5 mb-1"><Icon name="ClipboardCheck" size={13} className="text-secondary" /> Подача заявки</h3>
                <p>Заявка подаётся через форму на сайте до указанного в положении турнира времени. Ссылка на игру и код доступа направляются на электронную почту за 30 минут до начала. Авторизоваться на платформе нужно за 10 минут до старта.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground/80 flex items-center gap-1.5 mb-1"><Icon name="Award" size={13} className="text-secondary" /> Итоги и награждение</h3>
                <p>Официальные результаты публикуются в разделе «Результаты» в течение 3 дней после турнира. Победители и призёры получают дипломы I–III степени, все участники — диплом об участии, тренеры — благодарственные письма. Предусмотрены и специальные номинации.</p>
              </div>
            </div>
          </div>
        </div>
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
                    <span className="text-sm text-gray-600">
                      Соглашаюсь с{' '}
                      {modalTournament.regulation_url ? (
                        <a
                          href={modalTournament.regulation_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-secondary underline hover:no-underline"
                        >
                          условиями
                        </a>
                      ) : 'условиями'}
                      {' '}проведения соревнования
                    </span>
                  </label>
                  {submitError && <p className="text-red-500 text-sm">{submitError}</p>}
                  <Button type="submit" disabled={submitting || paymentLoading} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold mt-1">
                    {(submitting || paymentLoading)
                      ? <><Icon name="Loader2" size={16} className="mr-2 animate-spin" />Обработка...</>
                      : modalTournament.price && modalTournament.price > 0
                        ? <><Icon name="CreditCard" size={16} className="mr-2" />Оплатить {modalTournament.price.toLocaleString('ru')} ₽ и подать заявку</>
                        : <><Icon name="ClipboardCheck" size={16} className="mr-2" />Подать заявку</>
                    }
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
      {/* Модал списка участников */}
      {participantsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setParticipantsModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-heading font-bold text-xl text-primary">Список участников</h2>
              <button onClick={() => setParticipantsModal(null)} className="text-gray-400 hover:text-gray-600">
                <Icon name="X" size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">{participantsModal.title}</p>

            {participantsLoading ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <Icon name="Loader" size={28} className="animate-spin mr-2" /> Загрузка...
              </div>
            ) : participants.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-8">
                <Icon name="Users" size={36} className="mb-2 opacity-30" />
                <p>Заявок пока нет</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-400 mb-3 font-medium">Всего участников: <span className="text-primary font-bold">{participants.length}</span></p>
                <div className="overflow-y-auto flex-1 flex flex-col gap-1">
                  {participants.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                      <span className="text-gray-400 text-sm w-6 shrink-0 text-right">{i + 1}.</span>
                      <span className="font-medium text-gray-800 text-sm flex-1">{p.fio}</span>
                      {p.age && <span className="text-gray-400 text-sm shrink-0">{p.age}</span>}
                    </div>
                  ))}
                </div>
              </>
            )}
            <Button className="mt-4 w-full" variant="outline" onClick={() => setParticipantsModal(null)}>Закрыть</Button>
          </div>
        </div>
      )}

      {/* Modal просмотра изображения (анонс / образец диплома) */}
      {imagePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-8" onClick={() => setImagePreview(null)}>
          <div className="relative max-w-4xl w-full max-h-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <button className="absolute -top-10 right-0 text-white/80 hover:text-white" onClick={() => setImagePreview(null)}>
              <Icon name="X" size={26} />
            </button>
            <p className="text-white/90 text-sm font-medium mb-3 text-center">{imagePreview.title}</p>
            <img src={imagePreview.url} alt={imagePreview.title} className="max-w-full max-h-[80vh] object-contain rounded-lg bg-white" />
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}