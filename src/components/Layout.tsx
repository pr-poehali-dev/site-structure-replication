import { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import func2url from '../../backend/func2url.json';

const BALANCE_URL = func2url['balance'];

const NAV = [
  { label: 'Главная', href: '/' },
  { label: 'Турниры', href: '/turnir' },
  { label: 'Абонементы', href: '/subscriptions' },
  { label: 'Олимпиады', href: '/#olimpiady' },
  { label: 'Результаты', href: '/result' },
  { label: 'Заказать награды', href: '/kubki' },
  { label: 'Оплата', href: '/#pay' },
  { label: 'Контакты', href: '/#contacts' },
];

function LoginPopover({ trigger }: { trigger: React.ReactNode }) {
  const { login } = useAuth();
  const [open, setOpen] = useState(false);
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
      setOpen(false);
      setForm({ email: '', password: '' });
    } else {
      setError(res.error);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-primary mb-1">
            <Icon name="LogIn" size={18} className="text-secondary" />
            <h2 className="font-heading font-bold text-base">Вход</h2>
          </div>
          <div>
            <Label htmlFor="header-login-email">Email</Label>
            <Input
              id="header-login-email"
              type="email"
              required
              className="mt-1"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="header-login-password">Пароль</Label>
            <Input
              id="header-login-password"
              type="password"
              required
              className="mt-1"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button type="submit" disabled={submitting} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold">
            {submitting ? <><Icon name="Loader2" size={16} className="mr-2 animate-spin" />Входим...</> : 'Войти'}
          </Button>
          <p className="text-sm text-gray-500 text-center">
            Нет аккаунта? <a href="/register" className="text-secondary font-semibold hover:underline">Зарегистрироваться</a>
          </p>
        </form>
      </PopoverContent>
    </Popover>
  );
}

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, token, loading, logout } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);

  const fetchBalance = useCallback(() => {
    if (!token) return;
    fetch(BALANCE_URL, { headers: { 'X-Auth-Token': token } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setBalance(data.balance ?? 0))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (user && token) fetchBalance();
    else setBalance(null);
  }, [user, token, fetchBalance]);

  return (
    <header className="sticky top-0 z-50 bg-secondary/95 backdrop-blur border-b border-primary/10">
      <div className="container flex items-center justify-between h-16 px-4">
        <a href="/" />
        <nav className="hidden lg:flex items-center gap-1">
          {NAV.map((n) => (
            n.href === '/turnir' ? (
              <a
                key={n.href}
                href={n.href}
                className="relative px-4 py-2 rounded-lg text-sm font-bold text-white shadow-md hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 bg-[length:200%_100%] bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-600 animate-shimmer"
              >
                {n.label}
              </a>
            ) : (
              <a key={n.href} href={n.href} className="relative px-3 py-2 rounded-lg text-sm font-semibold text-primary/70 hover:text-primary hover:bg-primary/10 hover:-translate-y-0.5 transition-all duration-200 group">
                {n.label}
                <span className="absolute left-3 right-3 -bottom-0.5 h-0.5 rounded-full bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-center" />
              </a>
            )
          ))}
        </nav>
        <div className="hidden lg:flex items-center gap-2">
          {!loading && (
            user ? (
              <div className="flex items-center gap-3">
                <a
                  href="/cabinet?tab=balance"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-sm font-semibold text-primary hover:bg-primary/15 transition-colors"
                >
                  <Icon name="Wallet" size={14} />
                  {balance === null ? <Icon name="Loader2" size={13} className="animate-spin" /> : `${balance.toLocaleString('ru')} ₽`}
                </a>
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-primary/70 hover:text-primary transition-colors outline-none">
                    <Icon name="User" size={16} /> {user.last_name} {user.first_name} <Icon name="ChevronDown" size={14} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem asChild>
                      <a href="/cabinet?tab=tournaments" className="flex items-center gap-2 cursor-pointer">
                        <Icon name="Swords" size={16} /> Мои турниры
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href="/cabinet?tab=profile" className="flex items-center gap-2 cursor-pointer">
                        <Icon name="UserCog" size={16} /> Профиль
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href="/cabinet?tab=balance" className="flex items-center gap-2 cursor-pointer">
                        <Icon name="Wallet" size={16} /> Баланс
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="flex items-center gap-2 cursor-pointer text-red-500 focus:text-red-500">
                      <Icon name="LogOut" size={16} /> Выйти
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <LoginPopover
                trigger={
                  <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors">
                    <Icon name="LogIn" size={16} /> Войти
                  </button>
                }
              />
            )
          )}
        </div>
        <button className="lg:hidden text-primary" onClick={() => setMenuOpen((v) => !v)}>
          <Icon name={menuOpen ? 'X' : 'Menu'} size={26} />
        </button>
      </div>
      {menuOpen && (
        <nav className="lg:hidden bg-secondary px-4 pb-4 flex flex-col gap-1 animate-fade-in">
          {NAV.map((n) => (
            n.href === '/turnir' ? (
              <a
                key={n.href}
                href={n.href}
                onClick={() => setMenuOpen(false)}
                className="my-1 px-3 py-2 rounded-lg text-sm font-bold text-white shadow-md bg-[length:200%_100%] bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-600 animate-shimmer w-fit"
              >
                {n.label}
              </a>
            ) : (
              <a key={n.href} href={n.href} onClick={() => setMenuOpen(false)} className="py-2 text-primary/80 font-medium hover:text-primary border-b border-primary/10">
                {n.label}
              </a>
            )
          ))}
          {!loading && (
            user ? (
              <div className="flex flex-col gap-1 pt-1">
                <a href="/cabinet?tab=balance" onClick={() => setMenuOpen(false)} className="py-2 text-primary font-semibold flex items-center gap-2">
                  <Icon name="Wallet" size={16} />
                  {balance === null ? <Icon name="Loader2" size={14} className="animate-spin" /> : `${balance.toLocaleString('ru')} ₽`}
                </a>
                <a href="/cabinet" onClick={() => setMenuOpen(false)} className="py-2 text-primary/80 hover:text-primary flex items-center gap-2">
                  <Icon name="User" size={16} /> Личный кабинет
                </a>
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); logout(); }}
                  className="py-2 text-red-600 hover:text-red-700 flex items-center gap-2 text-left"
                >
                  <Icon name="LogOut" size={16} /> Выйти
                </button>
              </div>
            ) : (
              <a href="/login" onClick={() => setMenuOpen(false)} className="py-2 text-primary font-semibold flex items-center gap-2">
                <Icon name="LogIn" size={16} /> Войти
              </a>
            )
          )}
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer id="contacts" className="bg-secondary text-primary scroll-mt-16">
      <div className="container px-4 py-12 grid md:grid-cols-3 gap-10 items-start max-w-5xl mx-auto">
        {/* Лого + копирайт */}
        <div className="flex flex-col gap-3">
          <div className="bg-primary rounded-2xl px-5 py-4 inline-block w-fit">
            <img
              src="https://cdn.poehali.dev/projects/da0c042d-2017-4baf-94fb-5da234e7b163/bucket/5cb279c6-66b4-4693-bc8b-8649fcf4b0a8.png"
              alt="Мир шахмат"
              className="h-20 w-auto object-contain"
            />
          </div>
          <p className="text-sm text-primary/60">© {new Date().getFullYear()} Центр поддержки детского шахматного спорта</p>
        </div>

        {/* Контакты */}
        <div>
          <h2 className="font-heading font-bold text-2xl uppercase mb-4">Контакты</h2>
          <div className="space-y-3">
            <a href="mailto:mir.shahmat@inbox.ru" className="flex items-center gap-3 text-primary/80 hover:text-primary transition-colors text-sm">
              <Icon name="Mail" size={17} className="shrink-0" /> mir.shahmat@inbox.ru
            </a>
            <a href="tel:+79922281068" className="flex items-center gap-3 text-primary/80 hover:text-primary transition-colors text-sm">
              <Icon name="Phone" size={17} className="shrink-0" /> 8-99-222-810-68
            </a>
            <a href="https://мир-шахмат.рф" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-primary/80 hover:text-primary transition-colors text-sm">
              <Icon name="Globe" size={17} className="shrink-0" /> мир-шахмат.рф
            </a>
            <a href="https://vk.com/mir.shahmat" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-primary/80 hover:text-primary transition-colors text-sm">
              <Icon name="Users" size={17} className="shrink-0" /> vk.com/mir.shahmat
            </a>
          </div>
        </div>

        {/* Организатор */}
        <div>
          <h2 className="font-heading font-bold text-2xl uppercase mb-4">Организатор</h2>
          <p className="font-semibold text-primary">Мозжерин Илья Вячеславович</p>
          <p className="text-primary/60 text-sm mt-1">ИНН: 591703749251</p>
        </div>
      </div>
    </footer>
  );
}