import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Header, Footer } from '@/components/Layout';
import Seo from '@/components/Seo';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const res = await login(form.email.trim().toLowerCase(), form.password);
    setSubmitting(false);
    if (res.ok) {
      navigate('/cabinet');
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Seo title="Вход в личный кабинет" description="Вход в личный кабинет участника турниров" path="/login" noindex />
      <Header />

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <div className="flex items-center gap-2 mb-6">
            <Icon name="LogIn" size={22} className="text-secondary" />
            <h1 className="font-heading font-bold text-2xl text-primary">Вход</h1>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required className="mt-1" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="password">Пароль</Label>
              <Input id="password" type="password" required className="mt-1" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button type="submit" disabled={submitting} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold">
              {submitting ? <><Icon name="Loader2" size={16} className="mr-2 animate-spin" />Входим...</> : 'Войти'}
            </Button>
          </form>
          <p className="text-sm text-gray-500 mt-5 text-center">
            Нет аккаунта? <Link to="/register" className="text-secondary font-semibold hover:underline">Зарегистрироваться</Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
