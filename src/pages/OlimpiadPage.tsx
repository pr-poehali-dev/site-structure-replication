import { useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Header, Footer } from '@/components/Layout';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';

const OLIMPIADS: Record<string, {
  name: string;
  icon: string;
  tagline: string;
  desc: string;
  tasks: string[];
  who: string;
  price: string;
  awards: string[];
  polojenie: string | null;
}> = {
  debyut: {
    name: 'Дебют',
    icon: 'Swords',
    tagline: 'Олимпиада по дебютной теории',
    desc: 'Задания на знание дебютной базы, а также проверка знания основных правил игры в дебюте. Олимпиада проводится в интерактивном онлайн-формате — участвовать можно из любой точки мира.',
    tasks: [
      'Вопросы по основным дебютным принципам',
      'Определение правильного хода в дебютных позициях',
      'Знание популярных дебютных систем',
      'Разбор типовых дебютных ошибок',
    ],
    who: 'Олимпиада подходит для шахматистов любого уровня, желающих проверить и углубить знание дебютной теории.',
    price: '250',
    awards: ['Диплом I, II или III степени', 'Благодарственное письмо наставнику'],
    polojenie: null,
  },
  evrika: {
    name: 'Эврика',
    icon: 'Lightbulb',
    tagline: 'Олимпиада по решению шахматных задач',
    desc: 'Решение шахматных задач на тактику и комбинации. Проверь свою смекалку и наблюдательность — найди неожиданный ход, который меняет исход партии. Олимпиада проводится в интерактивном онлайн-формате.',
    tasks: [
      'Нахождение матов в 1–3 хода',
      'Решение тактических комбинаций',
      'Задачи на вилки, связки и двойные удары',
      'Эндшпильные этюды',
    ],
    who: 'Для шахматистов, которые хотят развить тактическое мышление и умение видеть нестандартные решения.',
    price: '250',
    awards: ['Диплом I, II или III степени', 'Благодарственное письмо наставнику'],
    polojenie: null,
  },
  erudit: {
    name: 'Эрудит',
    icon: 'BookOpen',
    tagline: 'Олимпиада по истории и теории шахмат',
    desc: 'Задания на знание правил и истории развития шахмат. Для тех, кто любит думать глубоко и знает шахматы не только за доской, но и в историческом контексте. Олимпиада проводится в интерактивном онлайн-формате.',
    tasks: [
      'История развития шахмат и великие чемпионы мира',
      'Правила проведения соревнований',
      'Шахматная нотация и терминология',
      'Знаменитые партии и их разбор',
    ],
    who: 'Для любознательных шахматистов, интересующихся не только игрой, но и её богатой историей и теорией.',
    price: '250',
    awards: ['Диплом I, II или III степени', 'Благодарственное письмо наставнику'],
    polojenie: null,
  },
};

const OlimpiadPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const o = slug ? OLIMPIADS[slug] : null;
  const [diplom, setDiplom] = useState(false);

  if (!o) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      {diplom && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setDiplom(false)}>
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setDiplom(false)} className="absolute -top-10 right-0 text-white/70 hover:text-white flex items-center gap-1 text-sm">
              <Icon name="X" size={18} /> Закрыть
            </button>
            <img src="https://cdn.poehali.dev/projects/da0c042d-2017-4baf-94fb-5da234e7b163/bucket/2ea2f61b-3108-4efc-a8fd-cf5414f5c9de.jpg" alt="Диплом" className="w-full rounded-xl shadow-2xl" />
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="bg-primary text-white relative overflow-hidden">
        <div className="absolute inset-0 chess-grid opacity-40" />
        <div className="container relative px-4 py-5 max-w-4xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/15 text-secondary text-sm font-semibold mb-6">
            <Icon name="Medal" size={15} /> Регулярные олимпиады
          </span>
          <div className="flex justify-center mb-6">
            <span className="grid place-items-center w-20 h-20 rounded-2xl bg-secondary text-secondary-foreground">
              <Icon name={o.icon} size={40} />
            </span>
          </div>
          <h1 className="font-heading font-bold text-4xl md:text-6xl uppercase leading-tight">
            Олимпиада <span className="text-secondary">«{o.name}»</span>
          </h1>
          <p className="mt-4 text-white/70 text-lg">{o.tagline}</p>
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2 text-sm">
              <Icon name="Monitor" size={15} className="text-secondary" /> Интерактивный онлайн-формат
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2 text-sm">
              <Icon name="Clock" size={15} className="text-secondary" /> Результаты за 2 рабочих дня
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2 text-sm">
              <Icon name="Globe" size={15} className="text-secondary" /> Из любой точки мира
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="container px-4 py-16 md:py-24 max-w-4xl mx-auto">
        <div className="grid md:grid-cols-2 gap-10">

          {/* Left */}
          <div className="flex flex-col gap-8">
            <div>
              <h2 className="font-heading font-bold text-2xl uppercase text-primary mb-4">Об олимпиаде</h2>
              <p className="text-muted-foreground leading-relaxed">{o.desc}</p>
              <div className="mt-4 flex items-start gap-3 rounded-xl border-l-4 border-secondary bg-secondary/10 px-4 py-3">
                <Icon name="GraduationCap" size={20} className="text-secondary shrink-0 mt-0.5" />
                <p className="text-sm text-foreground/85 leading-relaxed">
                  <span className="font-semibold text-primary">Задания подобраны индивидуально</span> — с учётом возраста участника и срока обучения шахматам.
                </p>
              </div>
            </div>

            <div>
              <h2 className="font-heading font-bold text-2xl uppercase text-primary mb-4">Что проверяем</h2>
              <ul className="space-y-3">
                {o.tasks.map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <Icon name="CircleCheckBig" size={20} className="text-secondary shrink-0 mt-0.5" />
                    <span className="text-foreground/85 text-sm leading-relaxed">{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="font-heading font-bold text-2xl uppercase text-primary mb-4">Кому подойдёт</h2>
              <p className="text-muted-foreground leading-relaxed text-sm">{o.who}</p>
            </div>

            <div className="rounded-2xl bg-primary text-white p-7 flex flex-col gap-4">
              <h3 className="font-heading font-bold text-xl uppercase">Готовы участвовать?</h3>
              <p className="text-white/75 text-sm leading-relaxed">Принять участие в олимпиаде «{o.name}» можно в любое время суток и в любой день недели.</p>
              <a
                href="/#pay"
                className="inline-flex items-center justify-center gap-2 bg-secondary text-secondary-foreground font-semibold rounded-xl px-5 py-3 text-sm hover:bg-secondary/90 transition-colors"
              >
                <Icon name="CreditCard" size={16} /> Оплатить и принять участие
              </a>
            </div>
          </div>

          {/* Right */}
          <div className="flex flex-col gap-6">
            <div className="rounded-2xl border border-border bg-card p-7">
              <h2 className="font-heading font-bold text-xl uppercase text-primary mb-5">Награды участников</h2>
              <ul className="space-y-3 mb-4">
                {o.awards.map((a) => (
                  <li key={a} className="flex items-start gap-3">
                    <Icon name="Trophy" size={18} className="text-secondary shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground/85">{a}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-start gap-3 rounded-xl bg-primary/6 border border-primary/15 px-4 py-3 mb-4">
                <Icon name="ShieldCheck" size={18} className="text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-foreground/80 leading-relaxed">
                  Каждый диплом имеет <span className="font-semibold text-primary">уникальный номер</span> и подтверждается официальными результатами в разделе{' '}
                  <a href="/#result" className="font-semibold text-secondary hover:underline">«Результаты»</a> на нашем сайте.
                </p>
              </div>
              <div className="border-t border-border pt-5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Стоимость участия</p>
                  <p className="font-heading font-bold text-3xl text-primary">{o.price} ₽</p>
                </div>
                {o.polojenie ? (
                  <a href={o.polojenie} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-secondary transition-colors">
                    <Icon name="FileText" size={16} /> Положение
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground cursor-not-allowed">
                    <Icon name="FileText" size={16} /> Положение скоро
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-5 pt-5 pb-3">
                <h2 className="font-heading font-bold text-xl uppercase text-primary mb-1">Образец диплома</h2>
                <p className="text-xs text-muted-foreground">Именной диплом для каждого участника</p>
              </div>
              <div className="relative group cursor-zoom-in" onClick={() => setDiplom(true)}>
                <img src="https://cdn.poehali.dev/projects/da0c042d-2017-4baf-94fb-5da234e7b163/bucket/2ea2f61b-3108-4efc-a8fd-cf5414f5c9de.jpg" alt="Образец диплома олимпиады" className="w-full object-contain max-h-64 object-top group-hover:opacity-80 transition-opacity" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="bg-black/60 text-white rounded-xl px-4 py-2 text-sm flex items-center gap-2">
                    <Icon name="ZoomIn" size={16} /> Посмотреть полностью
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Other olimpiads */}
      <section className="bg-muted/40">
        <div className="container px-4 py-12 max-w-4xl mx-auto">
          <h2 className="font-heading font-bold text-xl uppercase text-primary mb-6 text-center">Другие олимпиады</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {Object.entries(OLIMPIADS)
              .filter(([s]) => s !== slug)
              .map(([s, item]) => (
                <a
                  key={s}
                  href={`/olimpiad/${s}`}
                  className="group rounded-2xl border border-border bg-card p-5 flex items-center gap-4 hover:border-secondary hover:shadow-md transition-all"
                >
                  <span className="grid place-items-center w-11 h-11 rounded-xl bg-primary text-secondary shrink-0 group-hover:bg-secondary group-hover:text-secondary-foreground transition-colors">
                    <Icon name={item.icon} size={22} />
                  </span>
                  <div>
                    <p className="font-heading font-semibold text-sm uppercase text-primary">Олимпиада «{item.name}»</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.tagline}</p>
                  </div>
                </a>
              ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default OlimpiadPage;