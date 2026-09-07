import Icon from '@/components/ui/icon';

export default function TournamentRules() {
  return (
    <div className="lg:col-span-1 lg:sticky lg:top-6">
      <div className="rounded-xl border border-border bg-muted/40 px-5 py-4 md:px-6 md:py-5">
        <div className="flex items-center gap-2.5 mb-4">
          <Icon name="ScrollText" size={16} className="text-secondary shrink-0" />
          <h2 className="font-heading font-semibold text-sm md:text-base text-primary uppercase tracking-wide">Правила и регламент участия</h2>
        </div>

        <div className="flex flex-col gap-4 text-xs md:text-[13px] text-muted-foreground leading-relaxed">
          <div>
            <h3 className="font-semibold text-foreground/80 flex items-center gap-1.5 mb-1"><Icon name="Monitor" size={13} className="text-secondary" /> Формат проведения</h3>
            <p>Турниры проводятся онлайн на платформе Lichess.org по швейцарской системе. Количество туров зависит от числа участников (максимум 7).  Жеребьёвка каждого тура выполняется автоматически средствами платформы.</p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground/80 flex items-center gap-1.5 mb-1"><Icon name="Users" size={13} className="text-secondary" /> Участники и группы</h3>
            <p>К участию допускаются дети, зарегистрированные на Lichess.org. Перед участием каждый ребенок должен вступить в клуб <a href="https://lichess.org/team/weMlgSjB" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">«Мир шахмат»</a> на площадке lichess.org. Участники делятся на группы по рейтингу ФШР и возрасту — количество подгрупп зависит от общего числа заявок.</p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground/80 flex items-center gap-1.5 mb-1"><Icon name="ClipboardCheck" size={13} className="text-secondary" /> Подача заявки</h3>
            <p>Заявка подаётся через форму на сайте до указанного в положении турнира времени. Ссылка на игру и код доступа направляются на электронную почту за 30 минут до начала. Авторизоваться на платформе нужно за 10 минут до старта.</p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground/80 flex items-center gap-1.5 mb-1"><Icon name="Award" size={13} className="text-secondary" /> Итоги и награждение</h3>
            <p>Официальные результаты публикуются в разделе «Результаты» в течение 3 дней после турнира. Победители и призёры получают дипломы I–III степени, все участники — диплом об участии, тренеры — благодарственные письма. Предусмотрены и специальные номинации.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
