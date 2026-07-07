
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Header, Footer } from '@/components/Layout';

const HERO_IMG = 'https://cdn.poehali.dev/projects/da0c042d-2017-4baf-94fb-5da234e7b163/bucket/76b32a6f-e433-447e-98e3-d7bfa6e19bb3.png';

const NAV = [
  { label: 'Турниры', href: '/turnir' },
  { label: 'Фестивали', href: '#festivali' },
  { label: 'Шашки', href: '#shashki' },
  { label: 'Результаты', href: '#result' },
  { label: 'Дипломы', href: '#diplomy' },
  { label: 'Кубки', href: '#kubki' },
  { label: 'Оплата', href: '#pay' },
  { label: 'Контакты', href: '#contacts' },
];

const OLIMPIADS = [
  {
    name: 'Дебют',
    slug: 'debyut',
    icon: 'Swords',
    desc: 'Задания на знание дебютной базы, а также проверка знания основных правил игры в дебюте.',
    color: 'bg-primary text-secondary',
  },
  {
    name: 'Эврика',
    slug: 'evrika',
    icon: 'Lightbulb',
    desc: 'Решение шахматных задач на тактику и комбинации. Проверь свою смекалку и наблюдательность.',
    color: 'bg-secondary text-secondary-foreground',
  },
  {
    name: 'Эрудит',
    slug: 'erudit',
    icon: 'BookOpen',
    desc: 'Задания на знание правил и истории развития шахмат. Для тех, кто любит думать глубоко.',
    color: 'bg-primary text-secondary',
  },
];

const STATS = [
  { value: '1 000+', label: 'юных участников' },
  { value: '100+', label: 'проведённых турниров' },
  { value: '300+', label: 'комплектов наград' },
  { value: 'Россия', label: 'и страны СНГ' },
];

const SERVICES = [
  { id: 'turnir', icon: 'Swords', title: 'Турниры', desc: 'Регулярные шахматные турниры для детей всех уровней подготовки — от новичков до разрядников.' },
  { id: 'result', icon: 'ListChecks', title: 'Результаты', desc: 'Итоговые таблицы и протоколы прошедших соревнований доступны участникам и родителям.' },
  { id: 'kubki', icon: 'Award', title: 'Заказать награды', desc: 'Кубки, медали и памятные подарки для победителей и призёров турниров.' },
  { id: 'pay', icon: 'CreditCard', title: 'Оплата', desc: 'Удобная онлайн-оплата участия в турнирах и фестивалях центра «Мир шахмат».' },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

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
              <Button asChild size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold text-base h-12 px-7">
                <a href="/turnir"><Icon name="CalendarCheck" size={18} className="mr-2" /> Записаться на турнир</a>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 h-12 px-7 bg-transparent">
                <a href="#olimpiady">Олимпиады</a>
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
        <div className="container grid grid-cols-2 md:grid-cols-4 gap-4 px-4 py-6">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-heading font-bold text-3xl md:text-4xl">{s.value}</div>
              <div className="text-sm font-medium mt-1 opacity-80">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* About promo */}
      <section className="bg-white">
        <div className="container px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-7">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/15 text-secondary text-sm font-semibold mb-4">
              <Icon name="Sparkles" size={15} /> Официальные онлайн-турниры
            </span>
            <h2 className="font-heading font-bold text-3xl md:text-5xl uppercase text-primary leading-tight">
              Мир Шахмат — там, где ценят <span className="text-secondary">каждого</span> участника
            </h2>
            <p className="mt-5 text-muted-foreground text-lg leading-relaxed max-w-2xl mx-auto">
              Мы — ведущий центр поддержки детского шахматного спорта, специализирующийся на организации официальных онлайн-турниров и олимпиад. Наша миссия — создать для юных шахматистов платформу для развития, соревнований и признания их уникальных талантов.
            </p>
          </div>

          <h3 className="font-heading font-bold text-xl md:text-2xl text-primary text-center uppercase mb-6">Что отличает наши турниры?</h3>

          <div className="flex justify-center mb-10">
            <div className="inline-flex items-center gap-4 bg-primary/8 border border-primary/20 rounded-2xl px-6 py-4">
              <Icon name="Globe" size={22} className="text-secondary shrink-0" />
              <div>
                <p className="text-sm font-semibold text-primary">
                  Статус <span className="text-secondary">Всероссийского</span> или <span className="text-secondary">Международного</span> турнира
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">в зависимости от географии участников</p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-10">
            <div className="rounded-2xl border border-border bg-card p-7 flex flex-col gap-4">
              <span className="grid place-items-center w-14 h-14 rounded-xl bg-primary text-secondary">
                <Icon name="ScrollText" size={28} />
              </span>
              <h4 className="font-heading font-semibold text-lg text-primary uppercase">Официальные награды</h4>
              <p className="text-muted-foreground text-sm leading-relaxed">
                По итогам соревнований победители и призёры получают Дипломы I, II и III степени. Наставники получают благодарственные письма.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Все результаты подтверждены протоколами — смотреть в разделе <a href="/result" className="text-primary hover:text-secondary underline underline-offset-2 transition-colors">«Результаты»</a>
              </p>
            </div>

            <div className="rounded-2xl border border-secondary/40 bg-secondary/5 p-7 flex flex-col gap-4 md:col-span-1">
              <span className="grid place-items-center w-14 h-14 rounded-xl bg-secondary text-secondary-foreground">
                <Icon name="Trophy" size={28} />
              </span>
              <h4 className="font-heading font-semibold text-lg text-primary uppercase">Множество номинаций</h4>
              <p className="text-muted-foreground text-sm leading-relaxed mb-2">
                Шанс получить награду есть у каждого — вне зависимости от итогового места. Мы отмечаем самые яркие моменты:
              </p>
              <ul className="space-y-1.5">
                {['"Самый быстрый мат"', '"Самый красивый мат"', '"Лучшая шахматистка"', '"Юное дарование"', '"Боевая ничья"'].map(n => (
                  <li key={n} className="flex items-center gap-2 text-sm text-foreground/80">
                    <Icon name="Star" size={14} className="text-secondary shrink-0" />{n}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-card p-7 flex flex-col gap-4">
              <span className="grid place-items-center w-14 h-14 rounded-xl bg-primary text-secondary">
                <Icon name="Globe" size={28} />
              </span>
              <h4 className="font-heading font-semibold text-lg text-primary uppercase">Из любой точки мира</h4>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Соревнуйтесь с сильнейшими сверстниками, не выходя из дома. Доступность онлайн-формата открывает возможности для всех.
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-primary text-white p-8 flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
            <Icon name="Users" size={40} className="text-secondary shrink-0" />
            <div className="flex-1">
              <p className="text-lg font-medium leading-relaxed">
                Помогите своему ученику не просто играть в шахматы, а получать заслуженное признание и удовольствие от игры. Присоединяйтесь к нашим турнирам и следите за расписанием в нашей группе <span className="text-secondary font-semibold">ВКонтакте «Мир Шахмат»</span>.
              </p>
            </div>
            <a href="https://vk.com/mirshahmat" target="_blank" rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-2 bg-secondary text-secondary-foreground font-semibold px-6 py-3 rounded-xl hover:bg-secondary/90 transition-colors whitespace-nowrap">
              <Icon name="ExternalLink" size={16} /> Группа ВКонтакте
            </a>
          </div>
        </div>
        </div>
      </section>

      {/* Olimpiads */}
      <section id="olimpiady" className="bg-amber-50/60 scroll-mt-16">
        <div className="container px-4 py-8">
          <div className="text-center max-w-2xl mx-auto mb-4">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/15 text-secondary text-sm font-semibold mb-4">
              <Icon name="Medal" size={15} /> Регулярные олимпиады
            </span>
            <h2 className="font-heading font-bold text-3xl md:text-5xl uppercase text-primary">Регулярные олимпиады</h2>
          </div>
          <div className="flex flex-wrap justify-center gap-6 mb-10">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon name="Monitor" size={16} className="text-secondary" />
              Интерактивный онлайн-формат
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon name="Clock" size={16} className="text-secondary" />
              Результаты в течение 2 рабочих дней
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {OLIMPIADS.map((o) => (
              <div key={o.name} className="group rounded-2xl border border-border bg-card p-7 flex flex-col hover:shadow-xl hover:border-secondary transition-all">
                <span className={`grid place-items-center w-14 h-14 rounded-xl ${o.color} mb-5`}>
                  <Icon name={o.icon} size={28} />
                </span>
                <h3 className="font-heading font-semibold text-xl uppercase text-primary mb-3">
                  Олимпиада «{o.name}»
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed flex-1">{o.desc}</p>
                <a
                  href={`/olimpiad/${o.slug}`}
                  className="mt-6 inline-flex items-center justify-center gap-2 bg-secondary text-secondary-foreground font-semibold rounded-xl px-5 py-2.5 text-sm hover:bg-secondary/90 transition-colors"
                >
                  <Icon name="ArrowRight" size={16} /> Принять участие
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services / разделы */}
      <section className="bg-white chess-grid">
        <div className="container px-4 py-8">
          <div className="text-center max-w-2xl mx-auto mb-7">
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

      <Footer />
    </div>
  );
};

export default Index;