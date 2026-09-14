import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { calcAge, formatDate } from './utils';

export default function ProfileSection() {
  const { user, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const [form, setForm] = useState({
    last_name: user?.last_name || '',
    first_name: user?.first_name || '',
    middle_name: user?.middle_name || '',
    birth_date: user?.birth_date || '',
    fsr_id: user?.fsr_id || '',
    coach_fio: user?.coach_fio || '',
    institution: user?.institution || '',
    country_city: user?.country_city || '',
    phone: user?.phone || '',
  });

  function startEditing() {
    if (!user) return;
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
    setSaveMsg('');
    setEditing(true);
  }

  if (!user) return null;

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    const res = await updateProfile(form);
    setSaving(false);
    if (res.ok) {
      setEditing(false);
    } else {
      setSaveMsg(res.error);
    }
  }

  return !editing ? (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-bold text-lg text-primary">Данные профиля</h3>
        <Button variant="outline" size="sm" onClick={startEditing}>
          <Icon name="Pencil" size={14} className="mr-2" /> Редактировать
        </Button>
      </div>
      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div><dt className="text-gray-400">ID ФШР</dt><dd className="font-medium text-gray-800 mt-0.5">{user.fsr_id || '—'}</dd></div>
        <div><dt className="text-gray-400">Дата рождения</dt><dd className="font-medium text-gray-800 mt-0.5">{user.birth_date ? formatDate(user.birth_date) : '—'}</dd></div>
        <div><dt className="text-gray-400">ФИО тренера</dt><dd className="font-medium text-gray-800 mt-0.5">{user.coach_fio || '—'}</dd></div>
        <div><dt className="text-gray-400">Телефон</dt><dd className="font-medium text-gray-800 mt-0.5">{user.phone || '—'}</dd></div>
        <div><dt className="text-gray-400">Учреждение</dt><dd className="font-medium text-gray-800 mt-0.5">{user.institution || '—'}</dd></div>
        <div><dt className="text-gray-400">Страна / Город</dt><dd className="font-medium text-gray-800 mt-0.5">{user.country_city || '—'}</dd></div>
      </dl>
    </div>
  ) : (
    <form onSubmit={handleSaveProfile} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <div><Label>Фамилия *</Label><Input required className="mt-1" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} /></div>
        <div><Label>Имя *</Label><Input required className="mt-1" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} /></div>
        <div><Label>Отчество</Label><Input className="mt-1" value={form.middle_name} onChange={e => setForm({ ...form, middle_name: e.target.value })} /></div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <div><Label>Дата рождения</Label><Input type="date" className="mt-1" value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })} /></div>
        <div><Label>Возраст</Label><Input disabled className="mt-1 bg-gray-50" value={calcAge(form.birth_date) !== null ? `${calcAge(form.birth_date)} лет` : '—'} /></div>
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
      {saveMsg && <p className="text-sm text-red-500">{saveMsg}</p>}
      <div className="flex gap-2 mt-1">
        <Button type="submit" disabled={saving} className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold">
          {saving ? <><Icon name="Loader2" size={16} className="mr-2 animate-spin" />Сохраняем...</> : 'Сохранить изменения'}
        </Button>
        <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
