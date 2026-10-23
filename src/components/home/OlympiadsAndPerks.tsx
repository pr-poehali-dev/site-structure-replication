import { Link } from 'react-router-dom';
import Icon from '@/components/ui/icon';

const OLYMPIADS = [
  { name: 'Дебют', icon: 'Swords', desc: 'Дебютная база и правила игры в дебюте', color: 'bg-orange-100 text-orange-600' },
  { name: 'Эврика', icon: 'Lightbulb', desc: 'Тактика и комбинации, проверка смекалки', color: 'bg-blue-100 text-blue-600' },
  { name: 'Эрудит', icon: 'BookOpen', desc: 'Правила и история шахмат', color: 'bg-emerald-100 text-emerald-600' },
];

const PERKS = [
  { icon: 'ScrollText', title: 'Дипломы и благодарности', desc: 'Дипломы I–III степени, наставникам — благодарственные письма', color: 'bg-orange-100 text-orange-600' },
  { icon: 'Trophy', title: 'Множество номинаций', desc: '«Самый красивый мат», «Юное дарование», «Боевая ничья» и другие', color: 'bg-blue-100 text-blue-600' },
  { icon: 'Globe', title: 'Из любой точки мира', desc: 'Статус всероссийского или международного турнира', color: 'bg-emerald-100 text-emerald-600' },
];

export default function OlympiadsAndPerks() {
  return (
    <>
      <section className="rounded-2xl bg-white border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border">
          <h2 className="font-heading font-bold text-lg uppercase text-primary flex items-center gap-2">
            <Icon name="Medal" size={20} className="text-secondary" /> Регулярные олимпиады
          </h2>
          <Link to="/olimpiady" className="text-sm font-semibold text-secondary hover:underline flex items-center gap-1">
            Принять участие <Icon name="ArrowRight" size={14} />
          </Link>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 p-4">
          {OLYMPIADS.map(o => (
            <Link key={o.name} to="/olimpiady" className="rounded-xl border border-border p-4 hover:shadow-md hover:border-secondary/50 transition-all">
              <span className={`grid place-items-center w-10 h-10 rounded-lg mb-3 ${o.color}`}><Icon name={o.icon} size={20} /></span>
              <p className="font-heading font-bold uppercase text-primary leading-tight">«{o.name}»</p>
              <p className="text-xs text-muted-foreground mt-1 leading-snug">{o.desc}</p>
            </Link>
          ))}
        </div>
        <p className="px-5 pb-4 -mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-5 gap-y-1">
          <span className="flex items-center gap-1.5"><Icon name="Monitor" size={13} className="text-secondary" /> Интерактивный онлайн-формат</span>
          <span className="flex items-center gap-1.5"><Icon name="Clock" size={13} className="text-secondary" /> Результаты в течение 2 рабочих дней</span>
        </p>
      </section>

      <section className="rounded-2xl bg-white border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <h2 className="font-heading font-bold text-lg uppercase text-primary flex items-center gap-2">
            <Icon name="Sparkles" size={20} className="text-secondary" /> Что отличает наши турниры
          </h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 p-4">
          {PERKS.map(p => (
            <div key={p.title} className="rounded-xl bg-muted/50 p-4">
              <span className={`grid place-items-center w-10 h-10 rounded-lg mb-3 ${p.color}`}><Icon name={p.icon} size={20} /></span>
              <p className="font-semibold text-primary text-sm leading-tight">{p.title}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-snug">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
