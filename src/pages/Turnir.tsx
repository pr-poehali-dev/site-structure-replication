import { useState, useEffect, useCallback } from 'react';
import { Header, Footer } from '@/components/Layout';
import Seo from '@/components/Seo';
import { useAuth } from '@/contexts/AuthContext';
import TurnirHero from './turnir/TurnirHero';
import TournamentsList from './turnir/TournamentsList';
import TournamentRules from './turnir/TournamentRules';
import TournamentModals, { ApplicationForm } from './turnir/TournamentModals';
import { Tournament } from './turnir/types';
import func2url from '../../backend/func2url.json';

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
const APPS_URL = func2url['applications'];
const BALANCE_URL = func2url['balance'];

export default function Turnir() {
  const { user, token } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalTournament, setModalTournament] = useState<Tournament | null>(null);
  const [form, setForm] = useState<ApplicationForm>({ fio: '', age: '', fsr_id: '', coach: '', country_city: '', school: '', email: '', phone: '', agree: false });
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [myApplications, setMyApplications] = useState<{ tournament_id: number; status: string }[]>([]);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [balance, setBalance] = useState(0);

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

  const fetchMyApplications = useCallback(() => {
    if (!token) { setMyApplications([]); return; }
    fetch(`${APPS_URL}?scope=my`, { headers: { 'X-Auth-Token': token } })
      .then(r => r.json())
      .then(data => setMyApplications((data.applications || []).filter((a: { status: string }) => a.status !== 'cancelled')))
      .catch(() => {});
  }, [token]);

  const fetchBalance = useCallback(() => {
    if (!token) { setBalance(0); return; }
    fetch(BALANCE_URL, { headers: { 'X-Auth-Token': token } })
      .then(r => r.json())
      .then(data => setBalance(data.balance || 0))
      .catch(() => {});
  }, [token]);

  useEffect(() => { fetchMyApplications(); }, [fetchMyApplications]);
  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  async function handleCancelApplication(t: Tournament) {
    if (!token) return;
    if (!confirm(`Отменить участие в турнире «${t.title}»?`)) return;
    setCancellingId(t.id);
    try {
      await fetch(APPS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token },
        body: JSON.stringify({ _action: 'cancel', tournament_id: t.id }),
      });
      fetchMyApplications();
      fetchBalance();
    } finally {
      setCancellingId(null);
    }
  }

  function openModal(t: Tournament) {
    setModalTournament(t);
    setForm(user
      ? { fio: fullNameFromUser(user), age: calcAge(user.birth_date) !== null ? String(calcAge(user.birth_date)) : '', fsr_id: user.fsr_id || '', coach: user.coach_fio || '', country_city: user.country_city || '', school: user.institution || '', email: user.email || '', phone: user.phone || '', agree: false }
      : { fio: '', age: '', fsr_id: '', coach: '', country_city: '', school: '', email: '', phone: '', agree: false }
    );
    setSent(false);
    setSubmitError('');
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
          price: modalTournament.price || 0,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(data.error || 'Ошибка при отправке. Попробуйте ещё раз.');
        return;
      }
      setSent(true);
      fetchMyApplications();
      fetchBalance();
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
          appliedTournamentIds={myApplications.map(a => a.tournament_id)}
          onCancelApplication={handleCancelApplication}
          cancellingId={cancellingId}
        />
        <TournamentRules />
      </section>

      <TournamentModals
        user={user}
        balance={balance}
        modalTournament={modalTournament}
        closeModal={closeModal}
        sent={sent}
        form={form}
        setForm={setForm}
        handleSubmit={handleSubmit}
        submitting={submitting}
        submitError={submitError}
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
