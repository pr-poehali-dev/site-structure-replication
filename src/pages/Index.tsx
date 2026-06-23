import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';

const HERO_IMG = 'https://cdn.poehali.dev/projects/da0c042d-2017-4baf-94fb-5da234e7b163/bucket/76b32a6f-e433-447e-98e3-d7bfa6e19bb3.png';

const NAV = [
  { label: 'Турниры', href: '#turnir' },
  { label: 'Фестивали', href: '#festivali' },
  { label: 'Шашки', href: '#shashki' },
  { label: 'Результаты', href: '#result' },
  { label: 'Дипломы', href: '#diplomy' },
  { label: 'Кубки', href: '#kubki' },
  { label: 'Оплата', href: '#pay' },
  { label: 'Контакты', href: '#contacts' },
];

const FESTIVALS = [
  { name: 'Дебют', icon: 'Swords', desc: 'Турнир для начинающих шахматистов, делающих первые шаги в большой игре.' },
  { name: 'Эврика', icon: 'Lightbulb', desc: 'Фестиваль для смекалистых: задачи, комбинации и яркие открытия за доской.' },
  { name: 'Эрудит', icon: 'BookOpen', desc: 'Интеллектуальное состязание для тех, кто любит думать на несколько ходов вперёд.' },
  { name: 'Олимп', icon: 'Trophy', desc: 'Главный фестиваль сезона для сильнейших юных шахматистов.' },
];

const STATS = [
  { value: '1 000+', label: 'юных участников' },
  { value: '100+', label: 'проведённых турниров' },
  { value: '300+', label: 'лет опыта' },
  { value: '40+', label: 'городов' },
];

const SERVICES = [
  { id: 'turnir', icon: 'Swords', title: 'Турниры', desc: 'Регулярные шахматные турниры для детей всех уровней подготовки — от новичков до разрядников.' },
  { id: 'shashki', icon: 'CircleDot', title: 'Шашки', desc: 'Отдельное направление по шашкам: соревнования и фестивали для любителей русских и международных шашек.' },
  { id: 'result', icon: 'ListChecks', title: 'Результаты', desc: 'Итоговые таблицы и протоколы прошедших соревнований доступны участникам и родителям.' },
  { id: 'diplomy', icon: 'ScrollText', title: 'Дипломы', desc: 'Именные дипломы для каждого участника — заслуженная награда за старание и упорство.' },
  { id: 'kubki', icon: 'Award', title: 'Кубки и награды', desc: 'Кубки, медали и памятные подарки для победителей и призёров турниров.' },
  { id: 'pay', icon: 'CreditCard', title: 'Оплата', desc: 'Удобная онлайн-оплата участия в турнирах и фестивалях центра «Мир шахмат».' },
];

const Index = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-primary/95 backdrop-blur border-b border-white/10">
        <div className="container flex items-center justify-between h-16 px-4">
          <a href="#top" />
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

      {/* Hero */}
      <section id="top" className="relative overflow-hidden bg-primary text-white">
        <div className="absolute inset-0 chess-grid opacity-60" />
        <div className="container relative grid lg:grid-cols-2 gap-10 items-center px-4 py-5">
          <div className="animate-fade-in">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/15 text-secondary text-sm font-semibold mb-6">
              <Icon name="Sparkles" size={16} /> Центр поддержки детского шахматного спорта
            </span>
            <h1 className="font-heading font-bold text-4xl md:text-6xl leading-tight uppercase">
              Мир <span className="text-secondary">шахмат</span>
            </h1>
            <p className="mt-5 text-lg text-white/80 max-w-xl">
              Турниры, фестивали и праздники шахмат для детей. Мы растим чемпионов, развиваем мышление и дарим радость победы каждому юному игроку.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold text-base h-12 px-7">
                <Icon name="CalendarCheck" size={18} className="mr-2" /> Записаться на турнир
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 h-12 px-7 bg-transparent">
                <a href="#festivali">Наши фестивали</a>
              </Button>
            </div>
          </div>
          <div className="relative animate-scale-in flex items-center">
            <img src={HERO_IMG} alt="Шахматная доска" className="w-full h-full object-contain" style={{ maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)', WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)' }} />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-secondary text-secondary-foreground">
        <div className="container grid grid-cols-2 md:grid-cols-4 gap-6 px-4 py-10">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-heading font-bold text-3xl md:text-4xl">{s.value}</div>
              <div className="text-sm font-medium mt-1 opacity-80">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Festivals */}
      <section id="festivali" className="container px-4 py-16 md:py-24 scroll-mt-16">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="font-heading font-bold text-3xl md:text-5xl uppercase text-primary">Наши фестивали</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Серия ярких шахматных событий для детей разного уровня — от первых шагов до серьёзных побед.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FESTIVALS.map((f) => (
            <div key={f.name} className="group rounded-2xl border border-border bg-card p-7 hover-scale hover:border-secondary hover:shadow-xl">
              <span className="grid place-items-center w-14 h-14 rounded-xl bg-primary text-secondary mb-5 group-hover:bg-secondary group-hover:text-secondary-foreground transition-colors">
                <Icon name={f.icon} size={28} />
              </span>
              <h3 className="font-heading font-semibold text-xl uppercase text-primary">{f.name}</h3>
              <p className="mt-3 text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Services / разделы */}
      <section className="bg-muted/40 chess-grid">
        <div className="container px-4 py-16 md:py-24">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-heading font-bold text-3xl md:text-5xl uppercase text-primary">Разделы центра</h2>
            <p className="mt-4 text-muted-foreground text-lg">Всё, что нужно юному шахматисту и его родителям.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVICES.map((s) => (
              <div id={s.id} key={s.id} className="scroll-mt-24 rounded-2xl bg-card border border-border p-7 hover:shadow-xl transition-shadow">
                <div className="flex items-center gap-4 mb-4">
                  <span className="grid place-items-center w-12 h-12 rounded-xl bg-secondary/20 text-primary">
                    <Icon name={s.icon} size={24} />
                  </span>
                  <h3 className="font-heading font-semibold text-xl uppercase text-primary">{s.title}</h3>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
                <a href="#contacts" className="inline-flex items-center gap-1 mt-5 text-sm font-semibold text-primary hover:text-secondary transition-colors">
                  Подробнее <Icon name="ArrowRight" size={16} />
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section className="container px-4 py-16 md:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-heading font-bold text-3xl md:text-5xl uppercase text-primary">О центре «Мир шахмат»</h2>
            <p className="mt-5 text-muted-foreground text-lg leading-relaxed">
              Мы — центр поддержки детского шахматного спорта. Организуем турниры и фестивали, помогаем детям полюбить шахматы, развиваем логику, усидчивость и стремление к победе.
            </p>
            <ul className="mt-7 space-y-4">
              {[
                'Опытные судьи и тренеры',
                'Дипломы и награды каждому участнику',
                'Турниры для любого уровня подготовки',
                'Дружеская атмосфера и честная игра',
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <Icon name="CircleCheckBig" size={22} className="text-secondary shrink-0 mt-0.5" />
                  <span className="text-foreground/90">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="grid grid-cols-2 gap-4">
              {['Crown', 'Castle', 'CircleDot', 'Award'].map((ic, i) => (
                <div key={ic} className={`aspect-square rounded-2xl grid place-items-center ${i % 2 === 0 ? 'bg-primary text-secondary' : 'bg-secondary text-secondary-foreground'} animate-float`} style={{ animationDelay: `${i * 0.4}s` }}>
                  <Icon name={ic} size={56} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA / Contacts */}
      <section id="contacts" className="bg-primary text-white scroll-mt-16">
        <div className="container px-4 py-16 md:py-24">
          <div className="grid lg:grid-cols-2 gap-12">
            <div>
              <h2 className="font-heading font-bold text-3xl md:text-5xl uppercase">Контакты</h2>
              <p className="mt-4 text-white/75 text-lg">Свяжитесь с нами, чтобы записать ребёнка на турнир или задать вопрос.</p>
              <div className="mt-8 space-y-5">
                <a href="tel:+70000000000" className="flex items-center gap-4 text-white/90 hover:text-secondary transition-colors">
                  <span className="grid place-items-center w-11 h-11 rounded-xl bg-white/10"><Icon name="Phone" size={20} /></span>
                  +7 (000) 000-00-00
                </a>
                <a href="mailto:info@мир-шахмат.рф" className="flex items-center gap-4 text-white/90 hover:text-secondary transition-colors">
                  <span className="grid place-items-center w-11 h-11 rounded-xl bg-white/10"><Icon name="Mail" size={20} /></span>
                  info@мир-шахмат.рф
                </a>
                <div className="flex items-center gap-4 text-white/90">
                  <span className="grid place-items-center w-11 h-11 rounded-xl bg-white/10"><Icon name="MapPin" size={20} /></span>
                  Россия
                </div>
              </div>
            </div>
            <form className="bg-white/5 border border-white/10 rounded-2xl p-7 space-y-4">
              <h3 className="font-heading font-semibold text-xl uppercase">Записаться на турнир</h3>
              <input className="w-full h-12 rounded-lg bg-white/10 border border-white/15 px-4 text-white placeholder:text-white/50 focus:outline-none focus:border-secondary" placeholder="Имя ребёнка и родителя" />
              <input className="w-full h-12 rounded-lg bg-white/10 border border-white/15 px-4 text-white placeholder:text-white/50 focus:outline-none focus:border-secondary" placeholder="Телефон" />
              <textarea rows={3} className="w-full rounded-lg bg-white/10 border border-white/15 px-4 py-3 text-white placeholder:text-white/50 focus:outline-none focus:border-secondary" placeholder="Комментарий" />
              <Button type="button" size="lg" className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold h-12">
                Отправить заявку
              </Button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-white/70">
        <div className="container px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-white">
            <Icon name="Crown" size={20} className="text-secondary" />
            <span className="font-heading font-semibold uppercase tracking-wide">Мир шахмат</span>
          </div>
          <p className="text-sm">© {new Date().getFullYear()} Центр поддержки детского шахматного спорта</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;