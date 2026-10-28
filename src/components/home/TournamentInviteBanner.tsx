import { useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const STORAGE_KEY = 'invite-razgar-kanikul-seen';

const PERKS = [
  { icon: 'TrendingUp', text: 'Рейтинг МШ' },
  { icon: 'Award', text: 'Диплом каждому' },
  { icon: 'Users', text: 'Зачёт по возрастам' },
  { icon: 'Star', text: 'Номинации' },
];

export default function TournamentInviteBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY)) return;
    const t = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(t);
  }, []);

  const handleChange = (v: boolean) => {
    setOpen(v);
    if (!v) sessionStorage.setItem(STORAGE_KEY, '1');
  };

  return (
    <Dialog open={open} onOpenChange={handleChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border-0 rounded-3xl bg-transparent">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#7C4DFF] via-[#5B3FE0] to-[#2b1b5a] text-white p-6 md:p-8">
          <div className="absolute -right-12 -top-12 w-56 h-56 rounded-full bg-[#FFD83D]/40 blur-3xl" />
          <div className="absolute -left-16 bottom-0 w-56 h-56 rounded-full bg-[#2DB86B]/40 blur-3xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FFD83D] text-[#2b1b5a] text-xs font-extrabold tracking-wide mb-4 animate-pulse">
              <Icon name="Trophy" size={14} /> ЗАПИСЬ ОТКРЫТА
            </span>
            <DialogTitle className="font-heading font-extrabold text-3xl md:text-4xl uppercase leading-tight text-white">
              Турнир <span className="text-[#FFD83D]">«Разгар каникул»</span>
            </DialogTitle>
            <DialogDescription className="mt-3 text-base text-white/90">
              Сыграйте 7 партий, получите диплом и рейтинг. Онлайн, из дома!
            </DialogDescription>

            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-white/15 px-3 py-2"><div className="text-[10px] uppercase text-white/70">Когда</div><b>28 октября, 14:00 МСК</b></div>
              <div className="rounded-xl bg-white/15 px-3 py-2"><div className="text-[10px] uppercase text-white/70">Взнос</div><b>250 ₽</b></div>
              <div className="rounded-xl bg-white/15 px-3 py-2"><div className="text-[10px] uppercase text-white/70">Формат</div><b>Рапид 10+5, 7 туров</b></div>
              <div className="rounded-xl bg-white/15 px-3 py-2"><div className="text-[10px] uppercase text-white/70">Возраст</div><b>до 17 лет</b></div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {PERKS.map(p => (
                <span key={p.text} className="inline-flex items-center gap-1.5 text-xs bg-[#FFD83D]/20 text-[#FFD83D] rounded-full px-2.5 py-1 font-semibold">
                  <Icon name={p.icon} size={13} /> {p.text}
                </span>
              ))}
            </div>

            <Button asChild size="lg" className="mt-5 w-full bg-[#FFD83D] text-[#2b1b5a] hover:bg-[#ffe270] font-extrabold text-base h-12">
              <a href="/turnir"><Icon name="CalendarCheck" size={18} className="mr-2" /> Записаться на турнир</a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
