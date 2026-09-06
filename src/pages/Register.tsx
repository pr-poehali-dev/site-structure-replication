import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Header, Footer } from '@/components/Layout';
import Seo from '@/components/Seo';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';

const EMPTY_FORM = {
  last_name: '', first_name: '', middle_name: '', birth_date: '',
  fsr_id: '', coach_fio: '', institution: '', country_city: '',
  email: '', phone: '', password: '', password2: '',
};

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof typeof EMPTY_FORM>(key: K, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.password !== form.password2) {
      setError('Пароли не совпадают');
      return;
    }
    if (form.password.length < 6) {
      setError('Пароль должен быть не короче 6 символов');
      return;
    }
    setSubmitting(true);
    const res = await register({
      last_name: form.last_name,
      first_name: form.first_name,
      middle_name: form.middle_name || undefined,
      birth_date: form.birth_date || undefined,
      fsr_id: form.fsr_id || undefined,
      coach_fio: form.coach_fio || undefined,
      institution: form.institution || undefined,
      country_city: form.country_city || undefined,
      email: form.email.trim().toLowerCase(),
      phone: form.phone || undefined,
      password: form.password,
    });
    setSubmitting(false);
    if (res.ok) {
      navigate('/cabinet');
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Seo title="Регистрация участника" description="Регистрация нового участника турниров" path="/register" noindex />
      <Header />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <div className="flex items-center gap-2 mb-6">
            <Icon name="UserPlus" size={22} className="text-secondary" />
            <h1 className="font-heading font-bold text-2xl text-primary">Регистрация участника</h1>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label>Фамилия *</Label>
                <Input required className="mt-1" value={form.last_name} onChange={e => set('last_name', e.target.value)} />
              </div>
              <div>
                <Label>Имя *</Label>
                <Input required className="mt-1" value={form.first_name} onChange={e => set('first_name', e.target.value)} />
              </div>
              <div>
                <Label>Отчество</Label>
                <Input className="mt-1" value={form.middle_name} onChange={e => set('middle_name', e.target.value)} />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Дата рождения</Label>
                <Input type="date" className="mt-1" value={form.birth_date} onChange={e => set('birth_date', e.target.value)} />
              </div>
              <div>
                <Label>ID ФШР</Label>
                <Input className="mt-1" value={form.fsr_id} onChange={e => set('fsr_id', e.target.value)} placeholder="Номер в системе ФШР" />
              </div>
            </div>

            <div>
              <Label>ФИО тренера</Label>
              <Input className="mt-1" value={form.coach_fio} onChange={e => set('coach_fio', e.target.value)} />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Учреждение</Label>
                <Input className="mt-1" value={form.institution} onChange={e => set('institution', e.target.value)} placeholder="Шахматная школа / клуб" />
              </div>
              <div>
                <Label>Страна / Город</Label>
                <Input className="mt-1" value={form.country_city} onChange={e => set('country_city', e.target.value)} placeholder="Россия, Москва" />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Email представителя *</Label>
                <Input type="email" required className="mt-1" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              <div>
                <Label>Телефон представителя</Label>
                <Input type="tel" className="mt-1" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+7 999 000 00 00" />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Пароль *</Label>
                <Input type="password" required className="mt-1" value={form.password} onChange={e => set('password', e.target.value)} />
              </div>
              <div>
                <Label>Повторите пароль *</Label>
                <Input type="password" required className="mt-1" value={form.password2} onChange={e => set('password2', e.target.value)} />
              </div>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button type="submit" disabled={submitting} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold mt-1">
              {submitting ? <><Icon name="Loader2" size={16} className="mr-2 animate-spin" />Регистрируем...</> : 'Зарегистрироваться'}
            </Button>
          </form>
          <p className="text-sm text-gray-500 mt-5 text-center">
            Уже есть аккаунт? <Link to="/login" className="text-secondary font-semibold hover:underline">Войти</Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
