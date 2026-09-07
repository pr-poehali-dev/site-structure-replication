import { useState, useEffect } from 'react';
import { Header, Footer } from '@/components/Layout';
import { useYookassa, openPaymentPage } from '@/components/extensions/yookassa/useYookassa';
import Seo from '@/components/Seo';
import { useAuth } from '@/contexts/AuthContext';
import TurnirHero from './turnir/TurnirHero';
import TournamentsList from './turnir/TournamentsList';
import TournamentRules from './turnir/TournamentRules';
import TournamentModals, { ApplicationForm } from './turnir/TournamentModals';
import { Tournament } from './turnir/types';

function fullNameFromUser(u: { last_name: string; first_name: string; middle_name: string | null }) {
  return [u.last_name, u.first_name, u.middle_name].filter(Boolean).join(' ');
}

function calcAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  const monthDiff = today.getMonth() - b.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < b.getDate())) {
    age -= 1;
  }
  return age;
}

const API_URL = 'https://functions.poehali.dev/7761fec6-18a2-49d2-833d-2b2db37f330d';
const APPS_URL = 'https://functions.poehali.dev/a5d82f30-fb42-49b2-8c5e-5baac7ded4fa';
const YOOKASSA_URL = 'https://functions.poehali.dev/6e82b6ca-7ab9-4c14-b655-024798e28cc1';
const PROMO_CODES_URL = 'https://functions.poehali.dev/9b1bcd8a-a7eb-4420-9983-d32c3d1b6524';
const SUBSCRIPTIONS_URL = 'https://functions.poehali.dev/f7398788-c4ff-41d6-87e1-75303e227765';

export default function Turnir() {
  const { user, token } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalTournament, setModalTournament] = useState<Tournament | null>(null);
  const [form, setForm] = useState<ApplicationForm>({ fio: '', age: '', fsr_id: '', coach: '', country_city: '', school: '', email: '', phone: '', agree: false, promo_code: '' });
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [promoApplying, setPromoApplying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'pay' | 'promo' | 'subscription'>('pay');
  const [subscriptionCode, setSubscriptionCode] = useState('');

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
    setForm(user
      ? { fio: fullNameFromUser(user), age: calcAge(user.birth_date) !== null ? String(calcAge(user.birth_date)) : '', fsr_id: user.fsr_id || '', coach: user.coach_fio || '', country_city: user.country_city || '', school: user.institution || '', email: user.email || '', phone: user.phone || '', agree: false, promo_code: '' }
      : { fio: '', age: '', fsr_id: '', coach: '', country_city: '', school: '', email: '', phone: '', agree: false, promo_code: '' }
    );
    setSent(false);
    setPaymentMethod('pay');
    setSubscriptionCode('');
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
        headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Auth-Token': token } : {}) },
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

      if (isPaid && paymentMethod === 'promo' && form.promo_code.trim()) {
        setPromoApplying(true);
        const promoRes = await fetch(PROMO_CODES_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ _action: 'apply', code: form.promo_code.trim(), application_id: applicationId }),
        });
        setPromoApplying(false);
        if (promoRes.ok) {
          setSent(true);
          return;
        }
        const promoData = await promoRes.json().catch(() => ({}));
        setSubmitError(promoData.error || 'Не удалось применить промокод');
        return;
      }

      if (isPaid && paymentMethod === 'subscription' && subscriptionCode.trim()) {
        setPromoApplying(true);
        const subRes = await fetch(SUBSCRIPTIONS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ _action: 'apply', code: subscriptionCode.trim(), application_id: applicationId }),
        });
        setPromoApplying(false);
        if (subRes.ok) {
          setSent(true);
          return;
        }
        const subData = await subRes.json().catch(() => ({}));
        setSubmitError(subData.error || 'Не удалось применить код абонемента');
        return;
      }

      if (isPaid) {
        const payment = await createPayment({
          amount: modalTournament.price as number,
          userName: form.fio,
          userEmail: form.email,
          userPhone: form.phone,
          description: `${form.fio} — ${modalTournament.title}`,
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
      <Seo
        title="Турниры по шахматам для детей"
        description="Расписание детских шахматных турниров, онлайн-регистрация и подача заявки на участие. Турниры для всех уровней подготовки."
        path="/turnir"
      />
      <Header />

      <TurnirHero />

      {/* Tournaments + Правила */}
      <section className="container px-4 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <TournamentsList
          tournaments={tournaments}
          loading={loading}
          onOpenModal={openModal}
          onOpenParticipants={openParticipants}
          onOpenImagePreview={setImagePreview}
        />
        <TournamentRules />
      </section>

      <TournamentModals
        user={user}
        modalTournament={modalTournament}
        closeModal={closeModal}
        sent={sent}
        form={form}
        setForm={setForm}
        handleSubmit={handleSubmit}
        submitting={submitting}
        paymentLoading={paymentLoading}
        promoApplying={promoApplying}
        submitError={submitError}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        subscriptionCode={subscriptionCode}
        setSubscriptionCode={setSubscriptionCode}
        participantsModal={participantsModal}
        setParticipantsModal={setParticipantsModal}
        participants={participants}
        participantsLoading={participantsLoading}
        imagePreview={imagePreview}
        setImagePreview={setImagePreview}
      />

      <Footer />
    </div>
  );
}
