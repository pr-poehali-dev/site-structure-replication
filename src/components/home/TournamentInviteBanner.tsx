import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';

const PERKS = [
  { icon: 'TrendingUp', text: 'Рейтинг МШ' },
  { icon: 'Award', text: 'Диплом каждому' },
  { icon: 'Users', text: 'Зачёт по возрастам' },
  { icon: 'Star', text: 'Номинации' },
];

export default function TournamentInviteBanner() {
  return (
    <section className="bg-white pt-4">
      <div className="container px-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#14224F] to-[#1B2F6B] text-white">
          <div className="absolute -right-10 -top-10 w-56 h-56 rounded-full bg-secondary/30 blur-3xl" />
          <div className="relative grid md:grid-cols-[1fr_auto] gap-5 items-center p-5 md:p-7">
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white text-primary text-xs font-bold tracking-wide mb-3">
                <Icon name="Trophy" size={14} /> ЗАПИСЬ ОТКРЫТА
              </span>
              <h2 className="font-heading font-bold text-2xl md:text-4xl uppercase leading-tight">
                Турнир «Разгар каникул»
              </h2>
              <p className="mt-2 text-sm md:text-base text-white/80">
                28 октября в 14:00 МСК. Онлайн, рапид 10+5, 7 туров. Для детей до 17 лет, взнос 250 ₽.
              </p>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                {PERKS.map(p => (
                  <div key={p.text} className="flex items-center gap-2 text-xs bg-white/10 rounded-lg px-2.5 py-1.5">
                    <Icon name={p.icon} size={16} className="shrink-0" />
                    <span>{p.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <Button asChild size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold text-base h-12 px-7">
              <a href="/turnir"><Icon name="CalendarCheck" size={18} className="mr-2" /> Записаться</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
