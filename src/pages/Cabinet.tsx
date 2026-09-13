import { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Header, Footer } from '@/components/Layout';
import Seo from '@/components/Seo';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import BalanceSection from './cabinet/BalanceSection';
import ApplicationCard from './cabinet/ApplicationCard';
import ProfileSection from './cabinet/ProfileSection';
import func2url from '../../backend/func2url.json';

const APPS_URL = func2url['applications'];

interface MyApplication {
  id: number;
  tournament_id: number;
  tournament_title: string;
  fio: string;
  age: string;
  status: string;
  created_at: string;
  hall_open: boolean;
  tournament_status: string;
  description: string | null;
  date: string | null;
  location: string | null;
  age_category: string | null;
  price: number | null;
  time_control: string | null;
  time_msk: string | null;
  diploma_sample_url: string | null;
  regulation_url: string | null;
  announcement_url: string | null;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function Cabinet() {
  const { user, token, loading, logout } = useAuth();
  const [apps, setApps] = useState<MyApplication[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [tab, setTab] = useState<'tournaments' | 'balance' | 'profile'>(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab');
    return t === 'balance' || t === 'profile' ? t : 'tournaments';
  });

  useEffect(() => {
    if (!token) return;
    fetch(`${APPS_URL}?scope=my`, { headers: { 'X-Auth-Token': token } })
      .then(r => r.json())
      .then(d => setApps(d.applications || []))
      .finally(() => setAppsLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Icon name="Loader2" size={32} className="animate-spin text-secondary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const activeHalls = apps.filter(a => a.status === 'paid' && a.hall_open);
  const history = apps.filter(a => a.tournament_status === 'archived' || a.status === 'cancelled');
  const ongoing = apps.filter(a => !activeHalls.includes(a) && !history.includes(a));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Seo title="Личный кабинет" description="Личный кабинет участника турниров" path="/cabinet" noindex />
      <Header />

      <section className="bg-primary text-white relative overflow-hidden">
        <div className="absolute inset-0 chess-grid opacity-40" />
        <div className="container relative px-4 py-10 max-w-4xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-heading font-bold text-3xl md:text-4xl uppercase">
              Привет, <span className="text-secondary">{user.first_name}</span>!
            </h1>
            <p className="text-white/70 mt-1">{user.email}</p>
          </div>
          <Button variant="outline" className="border-white/30 text-white hover:bg-white/10 bg-transparent" onClick={logout}>
            <Icon name="LogOut" size={16} className="mr-2" /> Выйти
          </Button>
        </div>
      </section>

      <section className="container px-4 py-8 max-w-4xl mx-auto">
        <div className="flex gap-2 mb-6 border-b border-border">
          <button onClick={() => setTab('tournaments')} className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${tab === 'tournaments' ? 'border-secondary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            Мои турниры
          </button>
          <button onClick={() => setTab('balance')} className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${tab === 'balance' ? 'border-secondary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            Баланс
          </button>
          <button onClick={() => setTab('profile')} className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${tab === 'profile' ? 'border-secondary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            Профиль
          </button>
        </div>

        {tab === 'tournaments' && (
          <div className="flex flex-col gap-8">
            {activeHalls.length > 0 && (
              <div>
                <h2 className="font-heading font-bold text-xl text-primary uppercase mb-4 flex items-center gap-2">
                  <Icon name="DoorOpen" size={20} className="text-secondary" /> Турнирный зал
                </h2>
                <div className="flex flex-col gap-3">
                  {activeHalls.map(a => (
                    <div key={a.id} className="bg-white rounded-xl border-2 border-secondary/40 shadow-sm px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-semibold text-primary">{a.tournament_title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Заявка от {formatDate(a.created_at)}</p>
                      </div>
                      <Link to={`/hall/${a.tournament_id}`}>
                        <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold">
                          <Icon name="DoorOpen" size={16} className="mr-2" /> Войти в турнирный зал
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="font-heading font-bold text-xl text-primary uppercase mb-1 flex items-center gap-2">
                <Icon name="CalendarClock" size={20} className="text-secondary" /> Предстоящие турниры
              </h2>
              <p className="text-sm text-gray-400 mb-4 flex items-center gap-1.5">
                <Icon name="Info" size={14} className="shrink-0" /> Турнирный зал открывается за полчаса до начала турнира
              </p>
              {appsLoading ? (
                <div className="text-gray-400 py-6"><Icon name="Loader2" size={20} className="animate-spin inline mr-2" />Загрузка...</div>
              ) : ongoing.length === 0 ? (
                <div className="text-center py-10 bg-muted/40 rounded-xl text-gray-400">
                  <Icon name="Swords" size={32} className="mx-auto mb-2 opacity-30" />
                  <p>Вы пока не подавали заявок на турниры</p>
                  <Link to="/turnir" className="text-secondary font-semibold hover:underline mt-2 inline-block">Посмотреть турниры →</Link>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {ongoing.map(a => <ApplicationCard key={a.id} a={a} />)}
                </div>
              )}
            </div>

            <div>
              <h2 className="font-heading font-bold text-xl text-primary uppercase mb-4 flex items-center gap-2">
                <Icon name="History" size={20} className="text-secondary" /> История участия
              </h2>
              {!appsLoading && history.length === 0 ? (
                <div className="text-center py-10 bg-muted/40 rounded-xl text-gray-400">
                  <p>Пока нет завершённых турниров</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {history.map(a => <ApplicationCard key={a.id} a={a} />)}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'balance' && <BalanceSection />}

        {tab === 'profile' && <ProfileSection />}
      </section>

      <Footer />
    </div>
  );
}