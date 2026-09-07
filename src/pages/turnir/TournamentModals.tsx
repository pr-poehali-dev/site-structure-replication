import { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { UserProfile } from '@/contexts/AuthContext';
import { Tournament } from './types';

export interface ApplicationForm {
  fio: string;
  age: string;
  fsr_id: string;
  coach: string;
  country_city: string;
  school: string;
  email: string;
  phone: string;
  agree: boolean;
  promo_code: string;
}

interface TournamentModalsProps {
  user: UserProfile | null;

  // Модал заявки
  modalTournament: Tournament | null;
  closeModal: () => void;
  sent: boolean;
  form: ApplicationForm;
  setForm: Dispatch<SetStateAction<ApplicationForm>>;
  handleSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  paymentLoading: boolean;
  promoApplying: boolean;
  submitError: string;
  paymentMethod: 'pay' | 'promo' | 'subscription';
  setPaymentMethod: Dispatch<SetStateAction<'pay' | 'promo' | 'subscription'>>;
  subscriptionCode: string;
  setSubscriptionCode: Dispatch<SetStateAction<string>>;

  // Модал списка участников
  participantsModal: Tournament | null;
  setParticipantsModal: Dispatch<SetStateAction<Tournament | null>>;
  participants: { fio: string; age: string }[];
  participantsLoading: boolean;

  // Модал просмотра изображения
  imagePreview: { url: string; title: string } | null;
  setImagePreview: Dispatch<SetStateAction<{ url: string; title: string } | null>>;
}

export default function TournamentModals({
  user,
  modalTournament, closeModal, sent, form, setForm, handleSubmit,
  submitting, paymentLoading, promoApplying, submitError,
  paymentMethod, setPaymentMethod, subscriptionCode, setSubscriptionCode,
  participantsModal, setParticipantsModal, participants, participantsLoading,
  imagePreview, setImagePreview,
}: TournamentModalsProps) {
  return (
    <>
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
                {!user ? (
                  <div className="flex flex-col items-center text-center gap-3 py-6">
                    <Icon name="Lock" size={32} className="text-secondary" />
                    <p className="text-gray-600 text-sm">
                      Чтобы подать заявку на турнир, необходимо зарегистрироваться или войти в личный кабинет
                    </p>
                    <div className="flex gap-2 w-full mt-2">
                      <a href="/register" className="flex-1">
                        <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold">Зарегистрироваться</Button>
                      </a>
                      <a href="/login" className="flex-1">
                        <Button variant="outline" className="w-full">Войти</Button>
                      </a>
                    </div>
                  </div>
                ) : (
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
                    <label className="text-sm font-medium text-gray-700">ID ФШР *</label>
                    <input required className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary" placeholder="Номер в системе ФШР" value={form.fsr_id} onChange={e => setForm({ ...form, fsr_id: e.target.value })} />
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
                  {modalTournament.price && modalTournament.price > 0 && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Способ участия</label>
                      <div className="mt-1 grid grid-cols-3 gap-2">
                        <button type="button" onClick={() => setPaymentMethod('pay')} className={`px-2 py-2 rounded-lg text-xs font-medium border transition-colors ${paymentMethod === 'pay' ? 'bg-secondary text-secondary-foreground border-secondary' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                          Оплатить
                        </button>
                        <button type="button" onClick={() => setPaymentMethod('promo')} className={`px-2 py-2 rounded-lg text-xs font-medium border transition-colors ${paymentMethod === 'promo' ? 'bg-secondary text-secondary-foreground border-secondary' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                          Промокод
                        </button>
                        <button type="button" onClick={() => setPaymentMethod('subscription')} className={`px-2 py-2 rounded-lg text-xs font-medium border transition-colors ${paymentMethod === 'subscription' ? 'bg-secondary text-secondary-foreground border-secondary' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                          Абонемент
                        </button>
                      </div>
                      {paymentMethod === 'promo' && (
                        <input className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-secondary" placeholder="Введите промокод" value={form.promo_code} onChange={e => setForm({ ...form, promo_code: e.target.value.toUpperCase() })} />
                      )}
                      {paymentMethod === 'subscription' && (
                        <>
                          <input className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-secondary" placeholder="Код абонемента (AB-XXXXXXXX)" value={subscriptionCode} onChange={e => setSubscriptionCode(e.target.value.toUpperCase())} />
                          <a href="/subscriptions" target="_blank" className="text-xs text-secondary underline hover:no-underline mt-1 inline-block">Нет абонемента? Купить →</a>
                        </>
                      )}
                    </div>
                  )}
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
                  <Button
                    type="submit"
                    disabled={
                      submitting || paymentLoading || promoApplying ||
                      (!!modalTournament.price && modalTournament.price > 0 && paymentMethod === 'promo' && !form.promo_code.trim()) ||
                      (!!modalTournament.price && modalTournament.price > 0 && paymentMethod === 'subscription' && !subscriptionCode.trim())
                    }
                    className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold mt-1"
                  >
                    {(submitting || paymentLoading || promoApplying)
                      ? <><Icon name="Loader2" size={16} className="mr-2 animate-spin" />Обработка...</>
                      : modalTournament.price && modalTournament.price > 0
                        ? paymentMethod === 'promo'
                          ? <><Icon name="Gift" size={16} className="mr-2" />Подать заявку по промокоду</>
                          : paymentMethod === 'subscription'
                            ? <><Icon name="Ticket" size={16} className="mr-2" />Подать заявку по абонементу</>
                            : <><Icon name="CreditCard" size={16} className="mr-2" />Оплатить {modalTournament.price.toLocaleString('ru')} ₽ и подать заявку</>
                        : <><Icon name="ClipboardCheck" size={16} className="mr-2" />Подать заявку</>
                    }
                  </Button>
                </form>
                )}
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
    </>
  );
}
