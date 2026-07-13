import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import {
  Tournament, Application, AwardKit, AwardOrder, TournamentResult, PushSubscription,
  TOURNAMENTS_URL, APPS_URL, AWARD_CATALOG_ADMIN_URL, AWARD_ORDERS_URL, AWARD_TOURNAMENTS_URL, RESULTS_URL, PUSH_SUBSCRIPTIONS_LIST_URL,
  EMPTY_T_FORM, EMPTY_KIT_FORM, EMPTY_TR_FORM, Section,
} from './admin/adminTypes';
import TournamentsSection from './admin/TournamentsSection';
import ApplicationsSection from './admin/ApplicationsSection';
import AwardsSection, { AwardOrdersSection } from './admin/AwardsSection';
import ResultsSection from './admin/ResultsSection';
import SubscriptionsSection from './admin/SubscriptionsSection';
import PushNotificationsButton from './admin/PushNotificationsButton';

export default function Admin() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [section, setSection] = useState<Section>('tournaments');

  // Турниры
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tForm, setTForm] = useState(EMPTY_T_FORM);
  const [tLoading, setTLoading] = useState(false);
  const [tSaving, setTSaving] = useState(false);
  const [tShowForm, setTShowForm] = useState(false);
  const [tError, setTError] = useState('');
  const [tEditId, setTEditId] = useState<number | null>(null);

  // Заявки
  const [apps, setApps] = useState<Application[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [editApp, setEditApp] = useState<Application | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [filterTournament, setFilterTournament] = useState('');

  // Каталог наград
  const [awardKits, setAwardKits] = useState<AwardKit[]>([]);
  const [awardsLoading, setAwardsLoading] = useState(false);
  const [kitForm, setKitForm] = useState(EMPTY_KIT_FORM);
  const [editKit, setEditKit] = useState<AwardKit | null>(null);
  const [kitSaving, setKitSaving] = useState(false);
  const [showKitForm, setShowKitForm] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [kitError, setKitError] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);
  const editPhotoInputRef = useRef<HTMLInputElement>(null);

  // Заказы наград
  const [awardOrders, setAwardOrders] = useState<AwardOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Результаты турниров
  const [trResults, setTrResults] = useState<TournamentResult[]>([]);
  const [trLoading, setTrLoading] = useState(false);
  const [trForm, setTrForm] = useState(EMPTY_TR_FORM);
  const [trShowForm, setTrShowForm] = useState(false);
  const [trSaving, setTrSaving] = useState(false);
  const [trError, setTrError] = useState('');
  const [trEdit, setTrEdit] = useState<TournamentResult | null>(null);
  const [trUploading, setTrUploading] = useState<string | null>(null);
  const trProtocolRef = useRef<HTMLInputElement>(null);
  const trRegulationRef = useRef<HTMLInputElement>(null);
  const trEditProtocolRef = useRef<HTMLInputElement>(null);
  const trEditRegulationRef = useRef<HTMLInputElement>(null);

  // Подраздел внутри awards
  const [awardsTab, setAwardsTab] = useState<'kits' | 'tournaments'>('kits');
  const [awardsKitTournaments, setAwardsKitTournaments] = useState<Tournament[]>([]);
  const [aKitTLoading, setAKitTLoading] = useState(false);
  const [aKitTForm, setAKitTForm] = useState({ title: '', date: '' });
  const [aKitTShowForm, setAKitTShowForm] = useState(false);
  const [aKitTSaving, setAKitTSaving] = useState(false);
  const [aKitTError, setAKitTError] = useState('');

  // Подписки на push-уведомления
  const [subs, setSubs] = useState<PushSubscription[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem('admin_password');
    if (saved) { setPassword(saved); loginWith(saved); }
  }, []);

  async function loginWith(pwd: string) {
    setTLoading(true);
    const res = await fetch(TOURNAMENTS_URL, { headers: { 'X-Admin-Password': pwd } });
    if (res.status === 401) {
      setAuthError('Неверный пароль'); setAuthed(false);
      sessionStorage.removeItem('admin_password'); setTLoading(false); return;
    }
    const data = await res.json();
    setTournaments(data.tournaments || []);
    setAuthed(true); setAuthError(''); setTLoading(false);
    sessionStorage.setItem('admin_password', pwd);
  }

  async function fetchTournaments() {
    setTLoading(true);
    const res = await fetch(TOURNAMENTS_URL, { headers: { 'X-Admin-Password': password } });
    const data = await res.json();
    setTournaments(data.tournaments || []);
    setTLoading(false);
  }

  async function fetchApps() {
    setAppsLoading(true);
    const url = filterTournament ? `${APPS_URL}?tournament_id=${filterTournament}` : APPS_URL;
    const res = await fetch(url, { headers: { 'X-Admin-Password': password } });
    const data = await res.json();
    setApps(data.applications || []);
    setAppsLoading(false);
  }

  async function fetchAwardKits() {
    setAwardsLoading(true);
    const res = await fetch(AWARD_CATALOG_ADMIN_URL, { headers: { 'X-Admin-Password': password } });
    const data = await res.json();
    setAwardKits(data.items || []);
    setAwardsLoading(false);
  }

  async function fetchAwardOrders() {
    setOrdersLoading(true);
    const res = await fetch(AWARD_ORDERS_URL, { headers: { 'X-Admin-Password': password } });
    const data = await res.json();
    setAwardOrders(data.orders || []);
    setOrdersLoading(false);
  }

  async function fetchAwardKitTournaments() {
    setAKitTLoading(true);
    const res = await fetch(AWARD_TOURNAMENTS_URL, { headers: { 'X-Admin-Password': password } });
    const data = await res.json();
    setAwardsKitTournaments(data.tournaments || []);
    setAKitTLoading(false);
  }

  async function fetchTrResults() {
    setTrLoading(true);
    const res = await fetch(RESULTS_URL, { headers: { 'X-Admin-Password': password } });
    const data = await res.json();
    setTrResults(data.tournaments || []);
    setTrLoading(false);
  }

  async function fetchSubs() {
    setSubsLoading(true);
    const res = await fetch(PUSH_SUBSCRIPTIONS_LIST_URL, { headers: { 'X-Admin-Password': password } });
    const data = await res.json();
    setSubs(data.subscriptions || []);
    setSubsLoading(false);
  }

  useEffect(() => {
    if (authed) fetchApps();
  }, [authed, filterTournament]);

  useEffect(() => {
    if (authed && section === 'applications') fetchApps();
    if (authed && section === 'awards') { fetchAwardKits(); fetchAwardKitTournaments(); }
    if (authed && section === 'award-orders') fetchAwardOrders();
    if (authed && section === 'results') fetchTrResults();
    if (authed && section === 'subscriptions') fetchSubs();
  }, [section]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    await loginWith(password);
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
          <div className="flex items-center gap-2 mb-6">
            <Icon name="ShieldCheck" size={24} className="text-primary" />
            <h1 className="text-xl font-bold text-primary">Вход в админку</h1>
          </div>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="pwd">Пароль</Label>
              <Input id="pwd" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Введите пароль" className="mt-1" required />
            </div>
            {authError && <p className="text-red-500 text-sm">{authError}</p>}
            <Button type="submit" className="w-full">Войти</Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary text-white px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon name="Crown" size={20} />
          <span className="font-bold text-lg">Мир шахмат — Админка</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PushNotificationsButton password={password} />
          <Button variant="outline" size="sm" className="border-white/30 text-white hover:bg-white/10 bg-transparent"
            onClick={() => { sessionStorage.removeItem('admin_password'); setAuthed(false); setPassword(''); }}>
            <Icon name="LogOut" size={16} className="mr-1" /> Выйти
          </Button>
        </div>
      </header>

      {/* Nav tabs */}
      <div className="bg-white border-b border-gray-200 px-6 overflow-x-auto">
        <div className="max-w-6xl mx-auto flex gap-1 min-w-max">
          {([
            ['tournaments', 'Swords', 'Турниры'],
            ['applications', 'ClipboardList', 'Заявки'],
            ['awards', 'Award', 'Каталог наград'],
            ['award-orders', 'ShoppingCart', 'Заказы наград'],
            ['results', 'ListChecks', 'Результаты'],
            ['subscriptions', 'Bell', 'Подписки'],
          ] as const).map(([key, icon, label]) => (
            <button key={key} onClick={() => setSection(key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${section === key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Icon name={icon} size={16} />{label}
              {key === 'applications' && apps.length > 0 && (
                <span className="ml-1 bg-primary text-white text-xs rounded-full px-1.5 py-0.5">{apps.length}</span>
              )}
              {key === 'award-orders' && awardOrders.length > 0 && (
                <span className="ml-1 bg-secondary text-secondary-foreground text-xs rounded-full px-1.5 py-0.5">{awardOrders.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* === ТУРНИРЫ === */}
        {section === 'tournaments' && (
          <TournamentsSection
            password={password}
            tournaments={tournaments}
            apps={apps}
            tLoading={tLoading}
            tForm={tForm}
            setTForm={setTForm}
            tSaving={tSaving}
            setTSaving={setTSaving}
            tShowForm={tShowForm}
            setTShowForm={setTShowForm}
            tError={tError}
            setTError={setTError}
            tEditId={tEditId}
            setTEditId={setTEditId}
            fetchTournaments={fetchTournaments}
          />
        )}

        {/* === ЗАЯВКИ === */}
        {section === 'applications' && (
          <ApplicationsSection
            password={password}
            tournaments={tournaments}
            apps={apps}
            appsLoading={appsLoading}
            editApp={editApp}
            setEditApp={setEditApp}
            editSaving={editSaving}
            setEditSaving={setEditSaving}
            filterTournament={filterTournament}
            setFilterTournament={setFilterTournament}
            fetchApps={fetchApps}
          />
        )}

        {/* === КАТАЛОГ НАГРАД === */}
        {section === 'awards' && (
          <AwardsSection
            password={password}
            awardKits={awardKits}
            awardsLoading={awardsLoading}
            kitForm={kitForm}
            setKitForm={setKitForm}
            editKit={editKit}
            setEditKit={setEditKit}
            kitSaving={kitSaving}
            setKitSaving={setKitSaving}
            showKitForm={showKitForm}
            setShowKitForm={setShowKitForm}
            uploadingPhoto={uploadingPhoto}
            setUploadingPhoto={setUploadingPhoto}
            kitError={kitError}
            setKitError={setKitError}
            photoInputRef={photoInputRef}
            editPhotoInputRef={editPhotoInputRef}
            fetchAwardKits={fetchAwardKits}
            awardsTab={awardsTab}
            setAwardsTab={setAwardsTab}
            awardsKitTournaments={awardsKitTournaments}
            aKitTLoading={aKitTLoading}
            aKitTForm={aKitTForm}
            setAKitTForm={setAKitTForm}
            aKitTShowForm={aKitTShowForm}
            setAKitTShowForm={setAKitTShowForm}
            aKitTSaving={aKitTSaving}
            setAKitTSaving={setAKitTSaving}
            aKitTError={aKitTError}
            setAKitTError={setAKitTError}
            fetchAwardKitTournaments={fetchAwardKitTournaments}
          />
        )}

        {/* === ЗАКАЗЫ НАГРАД === */}
        {section === 'award-orders' && (
          <AwardOrdersSection
            password={password}
            awardOrders={awardOrders}
            ordersLoading={ordersLoading}
            fetchAwardOrders={fetchAwardOrders}
          />
        )}

        {/* === РЕЗУЛЬТАТЫ ТУРНИРОВ === */}
        {section === 'results' && (
          <ResultsSection
            password={password}
            trResults={trResults}
            trLoading={trLoading}
            trForm={trForm}
            setTrForm={setTrForm}
            trShowForm={trShowForm}
            setTrShowForm={setTrShowForm}
            trSaving={trSaving}
            setTrSaving={setTrSaving}
            trError={trError}
            setTrError={setTrError}
            trEdit={trEdit}
            setTrEdit={setTrEdit}
            trUploading={trUploading}
            setTrUploading={setTrUploading}
            trProtocolRef={trProtocolRef}
            trRegulationRef={trRegulationRef}
            trEditProtocolRef={trEditProtocolRef}
            trEditRegulationRef={trEditRegulationRef}
            fetchTrResults={fetchTrResults}
          />
        )}

        {/* === ПОДПИСКИ === */}
        {section === 'subscriptions' && (
          <SubscriptionsSection
            password={password}
            subs={subs}
            subsLoading={subsLoading}
            setSubs={setSubs}
            fetchSubs={fetchSubs}
          />
        )}

      </div>
    </div>
  );
}