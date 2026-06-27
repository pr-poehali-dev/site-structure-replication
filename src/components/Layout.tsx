import { useState } from 'react';
import Icon from '@/components/ui/icon';

const NAV = [
  { label: 'Турниры', href: '/turnir' },
  { label: 'Фестивали', href: '/#festivali' },
  { label: 'Шашки', href: '/#shashki' },
  { label: 'Результаты', href: '/#result' },
  { label: 'Дипломы', href: '/#diplomy' },
  { label: 'Кубки', href: '/#kubki' },
  { label: 'Оплата', href: '/#pay' },
  { label: 'Контакты', href: '/#contacts' },
];

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-primary/95 backdrop-blur border-b border-white/10">
      <div className="container flex items-center justify-between h-16 px-4">
        <a href="/" />
        <nav className="hidden lg:flex items-center gap-1">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="px-3 py-2 text-sm font-medium text-white/80 hover:text-secondary transition-colors">
              {n.label}
            </a>
          ))}
        </nav>
        <button className="lg:hidden text-white" onClick={() => setMenuOpen((v) => !v)}>
          <Icon name={menuOpen ? 'X' : 'Menu'} size={26} />
        </button>
      </div>
      {menuOpen && (
        <nav className="lg:hidden bg-primary px-4 pb-4 flex flex-col gap-1 animate-fade-in">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} onClick={() => setMenuOpen(false)} className="py-2 text-white/85 hover:text-secondary border-b border-white/10">
              {n.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="bg-black text-white/70">
      <div className="container px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center">
          <img src="https://cdn.poehali.dev/projects/da0c042d-2017-4baf-94fb-5da234e7b163/bucket/5cb279c6-66b4-4693-bc8b-8649fcf4b0a8.png" alt="Мир шахмат" className="h-16 w-auto object-contain" />
        </div>
        <p className="text-sm">© {new Date().getFullYear()} Центр поддержки детского шахматного спорта</p>
      </div>
    </footer>
  );
}