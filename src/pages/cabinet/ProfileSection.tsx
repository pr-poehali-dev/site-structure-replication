import { useState, useRef } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import BalanceSection from './BalanceSection';

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

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function initials(lastName: string, firstName: string) {
  return [lastName?.[0], firstName?.[0]].filter(Boolean).join('').toUpperCase();
}

function fileToBase64(file: File): Promise<{ base64: string; contentType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve({ base64, contentType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ProfileSection() {
  const { user, updateProfile, uploadAvatar } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const { base64, contentType } = await fileToBase64(file);
      await uploadAvatar(base64, contentType);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const age = calcAge(user.birth_date);

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      {/* Карточка профиля: аватар, ФИО, рейтинги */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-5 flex-wrap">
        <div className="relative shrink-0">
          <Avatar className="w-20 h-20 border-2 border-secondary/30">
            <AvatarImage src={user.avatar_url || undefined} alt={user.first_name} />
            <AvatarFallback className="bg-primary text-white font-heading font-bold text-xl">
              {initials(user.last_name, user.first_name)}
            </AvatarFallback>
          </Avatar>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shadow hover:bg-secondary/90 transition-colors"
            title="Загрузить фото"
          >
            <Icon name={uploadingAvatar ? 'Loader2' : 'Camera'} size={14} className={uploadingAvatar ? 'animate-spin' : ''} />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>

        <div className="flex-1 min-w-[160px]">
          <p className="font-heading font-bold text-lg text-primary">{user.last_name} {user.first_name} {user.middle_name || ''}</p>
          <p className="text-sm text-gray-400">{user.email}</p>
          {age !== null && <p className="text-sm text-gray-400 mt-0.5">{age} лет</p>}
        </div>

        <div className="flex gap-3">
          <div className="bg-muted/50 rounded-xl px-4 py-2.5 text-center min-w-[84px]">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Блиц</p>
            <p className="font-heading font-bold text-lg text-primary">{user.rating_blitz ?? '—'}</p>
          </div>
          <div className="bg-muted/50 rounded-xl px-4 py-2.5 text-center min-w-[84px]">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Рапид</p>
            <p className="font-heading font-bold text-lg text-primary">{user.rating_rapid ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* Баланс: пополнение, промокод, история операций */}
      <BalanceSection />

      {/* Данные профиля: просмотр или редактирование */}
      {!editing ? (
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
      )}
    </div>
  );
}