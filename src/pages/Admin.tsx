import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';

const TOURNAMENTS_URL = 'https://functions.poehali.dev/9a8eb98d-1a35-4b77-9828-603a76a903ed';
const APPS_URL = 'https://functions.poehali.dev/a5d82f30-fb42-49b2-8c5e-5baac7ded4fa';

interface Tournament {
  id: number; title: string; description: string; date: string | null;
  location: string; age_category: string; price: number | null; fsr_id: string; created_at: string;
}

interface Application {
  id: number; tournament_id: number | null; tournament_title: string;
  fio: string; age: string; fsr_id: string; coach: string; country_city: string;
  school: string; email: string; phone: string; status: string; notes: string; created_at: string;
}

const EMPTY_T_FORM = { title: '', description: '', date: '', location: '', age_category: '', price: '', fsr_id: '' };
const STATUS_LABELS: Record<string, string> = { new: 'Новая', confirmed: 'Подтверждена', paid: 'Оплачена', cancelled: 'Отменена' };
const STATUS_COLORS: Record<string, string> = { new: 'bg-blue-100 text-blue-700', confirmed: 'bg-green-100 text-green-700', paid: 'bg-yellow-100 text-yellow-700', cancelled: 'bg-red-100 text-red-700' };

type Section = 'tournaments' | 'applications';

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

  // Заявки
  const [apps, setApps] = useState<Application[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [editApp, setEditApp] = useState<Application | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [filterTournament, setFilterTournament] = useState('');

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

  useEffect(() => {
    if (authed && section === 'applications') fetchApps();
  }, [authed, section, filterTournament]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    await loginWith(password);
  }

  async function handleCreateTournament(e: React.FormEvent) {
    e.preventDefault();
    setTSaving(true); setTError('');
    const res = await fetch(TOURNAMENTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ ...tForm, price: tForm.price ? parseFloat(tForm.price) : null }),
    });
    if (res.ok) { setTForm(EMPTY_T_FORM); setTShowForm(false); fetchTournaments(); }
    else setTError('Ошибка при сохранении');
    setTSaving(false);
  }

  async function handleDeleteTournament(id: number) {
    if (!confirm('Удалить турнир?')) return;
    await fetch(TOURNAMENTS_URL + '/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ id }),
    });
    fetchTournaments();
  }

  async function handleSaveApp(e: React.FormEvent) {
    e.preventDefault();
    if (!editApp) return;
    setEditSaving(true);
    await fetch(APPS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ ...editApp, _action: 'update' }),
    });
    setEditSaving(false);
    setEditApp(null);
    fetchApps();
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
      <header className="bg-primary text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="Crown" size={20} />
          <span className="font-bold text-lg">Мир шахмат — Админка</span>
        </div>
        <Button variant="outline" size="sm" className="border-white/30 text-white hover:bg-white/10 bg-transparent"
          onClick={() => { sessionStorage.removeItem('admin_password'); setAuthed(false); setPassword(''); }}>
          <Icon name="LogOut" size={16} className="mr-1" /> Выйти
        </Button>
      </header>

      {/* Nav tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-5xl mx-auto flex gap-1">
          {([['tournaments', 'Swords', 'Турниры'], ['applications', 'ClipboardList', 'Заявки']] as const).map(([key, icon, label]) => (
            <button key={key} onClick={() => setSection(key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${section === key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Icon name={icon} size={16} />{label}
              {key === 'applications' && apps.length > 0 && (
                <span className="ml-1 bg-primary text-white text-xs rounded-full px-1.5 py-0.5">{apps.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* === ТУРНИРЫ === */}
        {section === 'tournaments' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
                <Icon name="Swords" size={22} /> Турниры
              </h2>
              <Button onClick={() => setTShowForm(!tShowForm)}>
                <Icon name={tShowForm ? 'X' : 'Plus'} size={16} className="mr-1" />
                {tShowForm ? 'Отмена' : 'Создать турнир'}
              </Button>
            </div>

            {tShowForm && (
              <form onSubmit={handleCreateTournament} className="bg-white rounded-2xl shadow p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label>Название *</Label>
                  <Input value={tForm.title} onChange={e => setTForm({ ...tForm, title: e.target.value })} placeholder="Например: Турнир «Весенний кубок»" required className="mt-1" />
                </div>
                <div className="md:col-span-2">
                  <Label>Описание</Label>
                  <Textarea value={tForm.description} onChange={e => setTForm({ ...tForm, description: e.target.value })} placeholder="Краткое описание" className="mt-1" rows={3} />
                </div>
                <div><Label>Дата</Label><Input type="date" value={tForm.date} onChange={e => setTForm({ ...tForm, date: e.target.value })} className="mt-1" /></div>
                <div><Label>Место</Label><Input value={tForm.location} onChange={e => setTForm({ ...tForm, location: e.target.value })} placeholder="Город, адрес" className="mt-1" /></div>
                <div><Label>Возраст / категория</Label><Input value={tForm.age_category} onChange={e => setTForm({ ...tForm, age_category: e.target.value })} placeholder="8–12 лет" className="mt-1" /></div>
                <div><Label>Стоимость (₽)</Label><Input type="number" value={tForm.price} onChange={e => setTForm({ ...tForm, price: e.target.value })} placeholder="500" className="mt-1" /></div>
                <div><Label>ID ФШР</Label><Input value={tForm.fsr_id} onChange={e => setTForm({ ...tForm, fsr_id: e.target.value })} placeholder="ID в системе ФШР" className="mt-1" /></div>
                {tError && <p className="md:col-span-2 text-red-500 text-sm">{tError}</p>}
                <div className="md:col-span-2 flex justify-end">
                  <Button type="submit" disabled={tSaving}>{tSaving ? 'Сохранение...' : 'Создать турнир'}</Button>
                </div>
              </form>
            )}

            {tLoading ? <div className="text-center py-12 text-gray-400">Загрузка...</div>
              : tournaments.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <Icon name="Swords" size={40} className="mx-auto mb-3 opacity-30" />
                  <p>Турниров пока нет. Создайте первый!</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {tournaments.map(t => (
                    <div key={t.id} className="bg-white rounded-2xl shadow p-5 flex flex-col md:flex-row md:items-start gap-4">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-primary">{t.title}</h3>
                        {t.description && <p className="text-gray-600 text-sm mt-1">{t.description}</p>}
                        <div className="flex flex-wrap gap-3 mt-3 text-sm text-gray-500">
                          {t.date && <span className="flex items-center gap-1"><Icon name="Calendar" size={14} />{t.date}</span>}
                          {t.location && <span className="flex items-center gap-1"><Icon name="MapPin" size={14} />{t.location}</span>}
                          {t.age_category && <span className="flex items-center gap-1"><Icon name="Users" size={14} />{t.age_category}</span>}
                          {t.price && <span className="flex items-center gap-1"><Icon name="CreditCard" size={14} />{t.price} ₽</span>}
                          {t.fsr_id && <span className="flex items-center gap-1"><Icon name="Hash" size={14} />ФШР: {t.fsr_id}</span>}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50" onClick={() => handleDeleteTournament(t.id)}>
                        <Icon name="Trash2" size={14} className="mr-1" /> Удалить
                      </Button>
                    </div>
                  ))}
                </div>
              )}
          </>
        )}

        {/* === ЗАЯВКИ === */}
        {section === 'applications' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
                <Icon name="ClipboardList" size={22} /> Заявки
              </h2>
              <select value={filterTournament} onChange={e => setFilterTournament(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Все турниры</option>
                {tournaments.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>

            {appsLoading ? <div className="text-center py-12 text-gray-400">Загрузка...</div>
              : apps.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <Icon name="ClipboardList" size={40} className="mx-auto mb-3 opacity-30" />
                  <p>Заявок пока нет</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {apps.map(a => (
                    <div key={a.id} className="bg-white rounded-2xl shadow p-5 flex flex-col md:flex-row md:items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-bold text-base text-primary">{a.fio}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-600'}`}>
                            {STATUS_LABELS[a.status] || a.status}
                          </span>
                        </div>
                        <p className="text-sm text-secondary font-medium mb-2">{a.tournament_title}</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-sm text-gray-500">
                          {a.age && <span><b>Возраст:</b> {a.age}</span>}
                          {a.fsr_id && <span><b>ФШР:</b> {a.fsr_id}</span>}
                          {a.coach && <span><b>Тренер:</b> {a.coach}</span>}
                          {a.country_city && <span><b>Город:</b> {a.country_city}</span>}
                          {a.school && <span><b>Учебное зав.:</b> {a.school}</span>}
                          {a.email && <span><b>Email:</b> {a.email}</span>}
                          {a.phone && <span><b>Тел.:</b> {a.phone}</span>}
                        </div>
                        {a.notes && <p className="mt-2 text-sm text-gray-500 italic">💬 {a.notes}</p>}
                        <p className="text-xs text-gray-400 mt-2">{new Date(a.created_at).toLocaleString('ru-RU')}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setEditApp({ ...a })}>
                        <Icon name="Pencil" size={14} className="mr-1" /> Изменить
                      </Button>
                    </div>
                  ))}
                </div>
              )}
          </>
        )}
      </div>

      {/* Модал редактирования заявки */}
      {editApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setEditApp(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-xl text-primary">Редактирование заявки</h2>
              <button onClick={() => setEditApp(null)} className="text-gray-400 hover:text-gray-600"><Icon name="X" size={20} /></button>
            </div>
            <form onSubmit={handleSaveApp} className="flex flex-col gap-3">
              <div><Label>ФИО участника</Label><Input className="mt-1" value={editApp.fio} onChange={e => setEditApp({ ...editApp, fio: e.target.value })} /></div>
              <div><Label>Возраст</Label><Input className="mt-1" value={editApp.age} onChange={e => setEditApp({ ...editApp, age: e.target.value })} /></div>
              <div><Label>ID ФШР</Label><Input className="mt-1" value={editApp.fsr_id} onChange={e => setEditApp({ ...editApp, fsr_id: e.target.value })} /></div>
              <div><Label>ФИО тренера</Label><Input className="mt-1" value={editApp.coach} onChange={e => setEditApp({ ...editApp, coach: e.target.value })} /></div>
              <div><Label>Страна / Город</Label><Input className="mt-1" value={editApp.country_city} onChange={e => setEditApp({ ...editApp, country_city: e.target.value })} /></div>
              <div><Label>Учебное заведение</Label><Input className="mt-1" value={editApp.school} onChange={e => setEditApp({ ...editApp, school: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" className="mt-1" value={editApp.email} onChange={e => setEditApp({ ...editApp, email: e.target.value })} /></div>
              <div><Label>Телефон</Label><Input className="mt-1" value={editApp.phone} onChange={e => setEditApp({ ...editApp, phone: e.target.value })} /></div>
              <div>
                <Label>Статус</Label>
                <select value={editApp.status} onChange={e => setEditApp({ ...editApp, status: e.target.value })}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="new">Новая</option>
                  <option value="confirmed">Подтверждена</option>
                  <option value="paid">Оплачена</option>
                  <option value="cancelled">Отменена</option>
                </select>
              </div>
              <div><Label>Заметки</Label><Textarea className="mt-1" rows={3} value={editApp.notes || ''} onChange={e => setEditApp({ ...editApp, notes: e.target.value })} placeholder="Внутренние заметки..." /></div>
              <div className="flex gap-3 justify-end mt-2">
                <Button type="button" variant="outline" onClick={() => setEditApp(null)}>Отмена</Button>
                <Button type="submit" disabled={editSaving}>{editSaving ? 'Сохранение...' : 'Сохранить'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}