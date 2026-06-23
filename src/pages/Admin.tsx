import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';

const API_URL = 'https://functions.poehali.dev/9a8eb98d-1a35-4b77-9828-603a76a903ed';

interface Tournament {
  id: number;
  title: string;
  description: string;
  date: string | null;
  location: string;
  age_category: string;
  price: number | null;
  fsr_id: string;
  created_at: string;
}

const EMPTY_FORM = { title: '', description: '', date: '', location: '', age_category: '', price: '', fsr_id: '' };

export default function Admin() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const savedPassword = sessionStorage.getItem('admin_password');

  useEffect(() => {
    if (savedPassword) {
      setPassword(savedPassword);
      fetchTournaments(savedPassword);
    }
  }, []);

  async function fetchTournaments(pwd: string) {
    setLoading(true);
    const res = await fetch(API_URL, { headers: { 'X-Admin-Password': pwd } });
    if (res.status === 401) {
      setAuthError('Неверный пароль');
      setAuthed(false);
      sessionStorage.removeItem('admin_password');
      setLoading(false);
      return;
    }
    const data = await res.json();
    setTournaments(data.tournaments || []);
    setAuthed(true);
    setAuthError('');
    setLoading(false);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    await fetchTournaments(password);
    if (!authError) sessionStorage.setItem('admin_password', password);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ ...form, price: form.price ? parseFloat(form.price) : null }),
    });
    if (res.ok) {
      setForm(EMPTY_FORM);
      setShowForm(false);
      fetchTournaments(password);
    } else {
      setError('Ошибка при сохранении');
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    if (!confirm('Удалить турнир?')) return;
    await fetch(API_URL + '/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({ id }),
    });
    fetchTournaments(password);
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

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Icon name="Swords" size={22} /> Турниры
          </h2>
          <Button onClick={() => setShowForm(!showForm)}>
            <Icon name={showForm ? 'X' : 'Plus'} size={16} className="mr-1" />
            {showForm ? 'Отмена' : 'Создать турнир'}
          </Button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="bg-white rounded-2xl shadow p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label>Название *</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Например: Турнир «Весенний кубок»" required className="mt-1" />
            </div>
            <div className="md:col-span-2">
              <Label>Описание</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Краткое описание турнира" className="mt-1" rows={3} />
            </div>
            <div>
              <Label>Дата проведения</Label>
              <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Место проведения</Label>
              <Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Город, адрес" className="mt-1" />
            </div>
            <div>
              <Label>Возраст / категория</Label>
              <Input value={form.age_category} onChange={e => setForm({ ...form, age_category: e.target.value })} placeholder="Например: 8–12 лет" className="mt-1" />
            </div>
            <div>
              <Label>Стоимость участия (₽)</Label>
              <Input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="Например: 500" className="mt-1" />
            </div>
            <div>
              <Label>ID ФШР</Label>
              <Input value={form.fsr_id} onChange={e => setForm({ ...form, fsr_id: e.target.value })} placeholder="ID турнира в системе ФШР" className="mt-1" />
            </div>
            {error && <p className="md:col-span-2 text-red-500 text-sm">{error}</p>}
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? 'Сохранение...' : 'Создать турнир'}
              </Button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-400">Загрузка...</div>
        ) : tournaments.length === 0 ? (
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
                <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50" onClick={() => handleDelete(t.id)}>
                  <Icon name="Trash2" size={14} className="mr-1" /> Удалить
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
