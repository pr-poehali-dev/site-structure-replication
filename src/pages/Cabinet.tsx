import { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Header, Footer } from '@/components/Layout';
import Seo from '@/components/Seo';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
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
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  new: { label: 'На рассмотрении', className: 'bg-blue-100 text-blue-700' },
  paid: { label: 'Подтверждено', className: 'bg-green-100 text-green-700' },
  pending_payment: { label: 'Ожидает оплаты', className: 'bg-orange-100 text-orange-700' },
  cancelled: { label: 'Отменено', className: 'bg-gray-100 text-gray-500' },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function Cabinet() {
  const { user, token, loading, logout, updateProfile } = useAuth();
  const [apps, setApps] = useState<MyApplication[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [tab, setTab] = useState<'tournaments' | 'profile'>('tournaments');

  const [form, setForm] = useState({
    last_name: '', first_name: '', middle_name: '', birth_date: '',
    fsr_id: '', coach_fio: '', institution: '', country_city: '', phone: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    if (user) {
      setForm({
        last_name: user.last_name || '',
        first_name: user.first_name || '',
        middle_name: user.middle_name || '',
        birth_date: user.birth_date || '',
        fsr_id: user.fsr_id || '',
        coach_fio: user.coach_fio || '',
        institution: user.institution || '',
        country_city: user.country_city || '',
        phone: user.phone || '',
      });
    }
  }, [user]);

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

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    const res = await updateProfile(form);
    setSaving(false);
    setSaveMsg(res.ok ? 'Профиль обновлён' : res.error);
  }

  const ongoing = apps.filter(a => a.status !== 'cancelled' && a.status !== 'paid');
  const history = apps.filter(a => a.status === 'paid' || a.status === 'cancelled');

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
          <button onClick={() => setTab('profile')} className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${tab === 'profile' ? 'border-secondary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            Профиль
          </button>
        </div>

        {tab === 'tournaments' && (
          <div className="flex flex-col gap-8">
            <div>
              <h2 className="font-heading font-bold text-xl text-primary uppercase mb-4 flex items-center gap-2">
                <Icon name="CalendarClock" size={20} className="text-secondary" /> Предстоящие турниры
              </h2>
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
                  {ongoing.map(a => {
                    const s = STATUS_LABELS[a.status] || STATUS_LABELS.new;
                    return (
                      <div key={a.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <p className="font-semibold text-primary">{a.tournament_title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">Заявка от {formatDate(a.created_at)}</p>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${s.className}`}>{s.label}</span>
                      </div>
                    );
                  })}
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
                  {history.map(a => {
                    const s = STATUS_LABELS[a.status] || STATUS_LABELS.new;
                    return (
                      <div key={a.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <p className="font-semibold text-primary">{a.tournament_title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">Заявка от {formatDate(a.created_at)}</p>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${s.className}`}>{s.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-3 max-w-xl">
            <div className="grid sm:grid-cols-3 gap-3">
              <div><Label>Фамилия *</Label><Input required className="mt-1" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} /></div>
              <div><Label>Имя *</Label><Input required className="mt-1" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} /></div>
              <div><Label>Отчество</Label><Input className="mt-1" value={form.middle_name} onChange={e => setForm({ ...form, middle_name: e.target.value })} /></div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label>Дата рождения</Label><Input type="date" className="mt-1" value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })} /></div>
              <div><Label>ID ФШР</Label><Input className="mt-1" value={form.fsr_id} onChange={e => setForm({ ...form, fsr_id: e.target.value })} /></div>
            </div>
            <div><Label>ФИО тренера</Label><Input className="mt-1" value={form.coach_fio} onChange={e => setForm({ ...form, coach_fio: e.target.value })} /></div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label>Учреждение</Label><Input className="mt-1" value={form.institution} onChange={e => setForm({ ...form, institution: e.target.value })} /></div>
              <div><Label>Страна / Город</Label><Input className="mt-1" value={form.country_city} onChange={e => setForm({ ...form, country_city: e.target.value })} /></div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label>Email</Label><Input disabled className="mt-1 bg-gray-50" value={user.email} /></div>
              <div><Label>Телефон представителя</Label><Input className="mt-1" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            {saveMsg && <p className={`text-sm ${saveMsg === 'Профиль обновлён' ? 'text-green-600' : 'text-red-500'}`}>{saveMsg}</p>}
            <Button type="submit" disabled={saving} className="w-full sm:w-auto bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold mt-1">
              {saving ? <><Icon name="Loader2" size={16} className="mr-2 animate-spin" />Сохраняем...</> : 'Сохранить изменения'}
            </Button>
          </form>
        )}
      </section>

      <Footer />
    </div>
  );
}
