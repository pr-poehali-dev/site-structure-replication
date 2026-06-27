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
    <footer id="contacts" className="bg-primary text-white scroll-mt-16">
      <div className="container px-4 py-12 grid md:grid-cols-2 gap-10 items-start max-w-5xl mx-auto">
        {/* Лого + копирайт */}
        <div className="flex flex-col gap-3">
          <img
            src="https://cdn.poehali.dev/projects/da0c042d-2017-4baf-94fb-5da234e7b163/bucket/5cb279c6-66b4-4693-bc8b-8649fcf4b0a8.png"
            alt="Мир шахмат"
            className="h-28 w-auto object-contain"
          />
          <p className="text-sm text-white/50">© {new Date().getFullYear()} Центр поддержки детского шахматного спорта</p>
        </div>

        {/* Контакты */}
        <div>
          <h2 className="font-heading font-bold text-2xl uppercase mb-1">Контакты</h2>
          <p className="text-white/50 text-xs uppercase font-semibold tracking-wide mb-1">Организатор</p>
          <p className="font-semibold text-white">Мозжерин Илья Вячеславович</p>
          <p className="text-white/60 text-sm mb-5">ИНН: 591703749251</p>
          <div className="space-y-3">
            <a href="mailto:mir.shahmat@inbox.ru" className="flex items-center gap-3 text-white/85 hover:text-secondary transition-colors text-sm">
              <Icon name="Mail" size={17} className="shrink-0" /> mir.shahmat@inbox.ru
            </a>
            <a href="tel:+79922281068" className="flex items-center gap-3 text-white/85 hover:text-secondary transition-colors text-sm">
              <Icon name="Phone" size={17} className="shrink-0" /> 8-99-222-810-68
            </a>
            <a href="https://мир-шахмат.рф" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-white/85 hover:text-secondary transition-colors text-sm">
              <Icon name="Globe" size={17} className="shrink-0" /> мир-шахмат.рф
            </a>
            <a href="https://vk.com/mir.shahmat" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-white/85 hover:text-secondary transition-colors text-sm">
              <Icon name="Users" size={17} className="shrink-0" /> vk.com/mir.shahmat
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}