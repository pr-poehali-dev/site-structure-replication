import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { TYPE_META, TournamentType } from '@/pages/turnir/TournamentTypeBadge';

const BANNER_IMG = 'https://cdn.poehali.dev/projects/da0c042d-2017-4baf-94fb-5da234e7b163/files/acc58395-9ef8-419c-bfb1-da2cc0ba2d84.jpg';

const FEATURES = [
  { icon: 'Gamepad2', text: 'Своя игровая площадка' },
  { icon: 'TrendingUp', text: 'Внутренний рейтинг' },
  { icon: 'Puzzle', text: 'Шахматные задачи' },
  { icon: 'ScrollText', text: 'Официальные результаты' },
  { icon: 'Sparkles', text: 'Бонусы за друзей' },
  { icon: 'UserRound', text: 'Личный кабинет' },
];

const TYPES: { key: TournamentType; short: string }[] = [
  { key: 'warmup', short: 'Открытые, без рейтинга и дипломов' },
  { key: 'training', short: 'Деление по рейтингу и диплом' },
  { key: 'qualifying', short: 'Полный набор и официальные результаты' },
];

export default function PortalUpdateBanner() {
  return (
    <section className="bg-white">
      <div className="container px-4 py-5">
        <div className="max-w-5xl mx-auto rounded-3xl overflow-hidden bg-gradient-to-br from-violet-600 to-indigo-800 text-white shadow-xl">
          <div className="grid md:grid-cols-4 gap-0">
            <div className="md:col-span-3 p-5 md:p-6">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-300 text-indigo-950 text-xs font-bold tracking-wide mb-3">
                <Icon name="Rocket" size={14} /> ПЕРЕЗАГРУЗКА ПОРТАЛА
              </span>
              <h2 className="font-heading font-bold text-xl md:text-3xl uppercase leading-tight">
                Мир шахмат стал игровым порталом!
              </h2>
              <p className="mt-2 text-sm text-violet-100 leading-relaxed">
                Мы полностью обновили сайт: теперь дети играют, тренируются и соревнуются прямо у нас, а родители следят за успехами в личном кабинете.
              </p>

              <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                {FEATURES.map(f => (
                  <div key={f.text} className="flex items-center gap-2 text-xs bg-white/10 rounded-lg px-2.5 py-1.5">
                    <Icon name={f.icon} size={16} className="text-yellow-300 shrink-0" />
                    <span>{f.text}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Button asChild size="default" className="bg-yellow-300 text-indigo-950 hover:bg-yellow-200 font-semibold h-10 px-5">
                  <a href="/register"><Icon name="UserPlus" size={18} className="mr-2" /> Присоединиться</a>
                </Button>
                <Button asChild size="default" variant="outline" className="border-white/40 text-white hover:bg-white/10 hover:text-white h-10 px-5 bg-transparent">
                  <a href="/turnir">Смотреть турниры</a>
                </Button>
              </div>
            </div>

            <div className="md:col-span-1 hidden md:block relative">
              <img src={BANNER_IMG} alt="Дети играют в шахматы на портале" className="absolute inset-0 w-full h-full object-cover" />
            </div>
          </div>

          <div className="bg-indigo-950/40 p-4 md:p-5">
            <p className="text-xs font-bold tracking-wide text-violet-200 mb-2">ТРИ ТИПА ТУРНИРОВ</p>
            <div className="grid sm:grid-cols-3 gap-2">
              {TYPES.map(t => {
                const m = TYPE_META[t.key];
                return (
                  <div key={t.key} className="bg-white rounded-xl p-3 text-foreground">
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold border ${m.badge}`}>
                      <Icon name={m.icon} size={13} /> {m.label}
                    </span>
                    <p className="mt-1.5 text-xs text-muted-foreground">{t.short}</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-violet-100 flex items-start gap-2">
              <Icon name="Gift" size={18} className="text-yellow-300 shrink-0 mt-0.5" />
              Приглашайте друзей: получайте 25% от их пополнений бонусами и оплачивайте ими участие в турнирах, в том числе квалификационных.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
