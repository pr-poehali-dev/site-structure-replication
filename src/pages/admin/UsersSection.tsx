import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { UserAccount, AUTH_URL } from './adminTypes';

interface UsersSectionProps {
  password: string;
}

const EMPTY_FORM = {
  last_name: '', first_name: '', middle_name: '', birth_date: '', fsr_id: '',
  coach_fio: '', institution: '', country_city: '', email: '', phone: '',
  rating_blitz: '', rating_rapid: '', fsr_rating_blitz: '', fsr_rating_rapid: '',
};

function initials(lastName: string, firstName: string) {
  return [lastName?.[0], firstName?.[0]].filter(Boolean).join('').toUpperCase();
}

export default function UsersSection({ password }: UsersSectionProps) {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editUser, setEditUser] = useState<UserAccount | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchUsers = useCallback(async (q = '') => {
    setLoading(true);
    const url = q ? `${AUTH_URL}?search=${encodeURIComponent(q)}` : AUTH_URL;
    const res = await fetch(url, { headers: { 'X-Admin-Password': password } });
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  }, [password]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function openEdit(u: UserAccount) {
    setEditUser(u);
    setFormError('');
    setForm({
      last_name: u.last_name || '',
      first_name: u.first_name || '',
      middle_name: u.middle_name || '',
      birth_date: u.birth_date ? u.birth_date.slice(0, 10) : '',
      fsr_id: u.fsr_id || '',
      coach_fio: u.coach_fio || '',
      institution: u.institution || '',
      country_city: u.country_city || '',
      email: u.email || '',
      phone: u.phone || '',
      rating_blitz: u.rating_blitz != null ? String(u.rating_blitz) : '',
      rating_rapid: u.rating_rapid != null ? String(u.rating_rapid) : '',
      fsr_rating_blitz: u.fsr_rating_blitz != null ? String(u.fsr_rating_blitz) : '',
      fsr_rating_rapid: u.fsr_rating_rapid != null ? String(u.fsr_rating_rapid) : '',
    });
  }

  async function handleSaveUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setSaving(true);
    setFormError('');
    const res = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
      body: JSON.stringify({
        _action: 'admin_update_user',
        user_id: editUser.id,
        last_name: form.last_name.trim(),
        first_name: form.first_name.trim(),
        middle_name: form.middle_name.trim() || null,
        birth_date: form.birth_date || null,
        fsr_id: form.fsr_id.trim() || null,
        coach_fio: form.coach_fio.trim() || null,
        institution: form.institution.trim() || null,
        country_city: form.country_city.trim() || null,
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        rating_blitz: form.rating_blitz ? Number(form.rating_blitz) : null,
        rating_rapid: form.rating_rapid ? Number(form.rating_rapid) : null,
        fsr_rating_blitz: form.fsr_rating_blitz ? Number(form.fsr_rating_blitz) : null,
        fsr_rating_rapid: form.fsr_rating_rapid ? Number(form.fsr_rating_rapid) : null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) {
      toast.success('Данные участника обновлены');
      setEditUser(null);
      fetchUsers(search);
    } else {
      setFormError(data.error || 'Не удалось сохранить данные');
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Icon name="Users" size={22} /> Участники
        </h2>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Поиск по имени или email"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchUsers(search)}
            className="w-56"
          />
          <Button variant="outline" size="sm" onClick={() => fetchUsers(search)} disabled={loading}>
            <Icon name="RefreshCw" size={14} className={`mr-1 ${loading ? 'animate-spin' : ''}`} /> Обновить
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Загрузка...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Icon name="Users" size={40} className="mx-auto mb-3 opacity-30" />
          <p>Участники не найдены</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {users.map(u => (
            <div key={u.id} className="bg-white rounded-2xl shadow p-5 flex items-center gap-4 flex-wrap">
              <Avatar className="w-12 h-12 shrink-0">
                <AvatarImage src={u.avatar_url || undefined} alt={u.first_name} />
                <AvatarFallback className="bg-gradient-to-br from-secondary/70 to-secondary text-white font-heading font-bold">
                  {initials(u.last_name, u.first_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-[180px]">
                <p className="font-semibold text-primary">{u.last_name} {u.first_name} {u.middle_name || ''}</p>
                <p className="text-sm text-gray-400">{u.email}</p>
              </div>
              <div className="flex gap-3 shrink-0">
                <div className="flex gap-1.5">
                  <div className="bg-muted/50 rounded-lg px-3 py-1.5 text-center min-w-[70px]">
                    <p className="text-[9px] text-gray-400 uppercase tracking-wide">МШ Блиц</p>
                    <p className="font-bold text-primary">{u.rating_blitz ?? '—'}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg px-3 py-1.5 text-center min-w-[70px]">
                    <p className="text-[9px] text-gray-400 uppercase tracking-wide">МШ Рапид</p>
                    <p className="font-bold text-primary">{u.rating_rapid ?? '—'}</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <div className="bg-secondary/10 rounded-lg px-3 py-1.5 text-center min-w-[70px]">
                    <p className="text-[9px] text-gray-400 uppercase tracking-wide">ФШР Блиц</p>
                    <p className="font-bold text-primary">{u.fsr_rating_blitz ?? '—'}</p>
                  </div>
                  <div className="bg-secondary/10 rounded-lg px-3 py-1.5 text-center min-w-[70px]">
                    <p className="text-[9px] text-gray-400 uppercase tracking-wide">ФШР Рапид</p>
                    <p className="font-bold text-primary">{u.fsr_rating_rapid ?? '—'}</p>
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => openEdit(u)} className="shrink-0">
                <Icon name="Pencil" size={14} className="mr-1" /> Редактировать
              </Button>
            </div>
          ))}
        </div>
      )}

      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setEditUser(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-xl text-primary">Редактирование участника</h2>
              <button onClick={() => setEditUser(null)} className="text-gray-400 hover:text-gray-600"><Icon name="X" size={20} /></button>
            </div>
            <form onSubmit={handleSaveUser} className="flex flex-col gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Личные данные</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label>Фамилия *</Label>
                    <Input className="mt-1" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} required />
                  </div>
                  <div>
                    <Label>Имя *</Label>
                    <Input className="mt-1" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} required />
                  </div>
                  <div>
                    <Label>Отчество</Label>
                    <Input className="mt-1" value={form.middle_name} onChange={e => setForm(f => ({ ...f, middle_name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Дата рождения</Label>
                    <Input type="date" className="mt-1" value={form.birth_date} onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))} />
                  </div>
                  <div>
                    <Label>ID ФШР</Label>
                    <Input className="mt-1" value={form.fsr_id} onChange={e => setForm(f => ({ ...f, fsr_id: e.target.value }))} />
                  </div>
                  <div>
                    <Label>ФИО тренера</Label>
                    <Input className="mt-1" value={form.coach_fio} onChange={e => setForm(f => ({ ...f, coach_fio: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Учебное заведение</Label>
                    <Input className="mt-1" value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Страна / Город</Label>
                    <Input className="mt-1" value={form.country_city} onChange={e => setForm(f => ({ ...f, country_city: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Контакты</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Email *</Label>
                    <Input type="email" className="mt-1" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                  </div>
                  <div>
                    <Label>Телефон</Label>
                    <Input className="mt-1" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Рейтинг МШ</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Блиц</Label>
                    <Input type="number" className="mt-1" value={form.rating_blitz} onChange={e => setForm(f => ({ ...f, rating_blitz: e.target.value }))} placeholder="Например: 1450" />
                  </div>
                  <div>
                    <Label>Рапид</Label>
                    <Input type="number" className="mt-1" value={form.rating_rapid} onChange={e => setForm(f => ({ ...f, rating_rapid: e.target.value }))} placeholder="Например: 1520" />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Рейтинг ФШР</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Блиц</Label>
                    <Input type="number" className="mt-1" value={form.fsr_rating_blitz} onChange={e => setForm(f => ({ ...f, fsr_rating_blitz: e.target.value }))} placeholder="Например: 1450" />
                  </div>
                  <div>
                    <Label>Рапид</Label>
                    <Input type="number" className="mt-1" value={form.fsr_rating_rapid} onChange={e => setForm(f => ({ ...f, fsr_rating_rapid: e.target.value }))} placeholder="Например: 1520" />
                  </div>
                </div>
              </div>
              {formError && <p className="text-red-500 text-sm">{formError}</p>}
              <div className="flex gap-2 mt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEditUser(null)}>Отмена</Button>
                <Button type="submit" className="flex-1" disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}