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
            <p>Турниры проводятся онлайн в собственном турнирном зале на нашем сайте по швейцарской системе. Количество туров зависит от числа участников (максимум 7). Пары на каждый тур формируются автоматически на основе набранных очков.</p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground/80 flex items-center gap-1.5 mb-1"><Icon name="ClipboardCheck" size={13} className="text-secondary" /> Регистрация и заявка</h3>
            <p>Для участия нужно зарегистрироваться на сайте и подать заявку на выбранный турнир через личный кабинет до указанного в положении времени. Если участие платное, оплата списывается с баланса личного кабинета.</p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground/80 flex items-center gap-1.5 mb-1"><Icon name="DoorOpen" size={13} className="text-secondary" /> Вход в турнирный зал</h3>
            <p>Турнирный зал открывается за 30 минут до начала турнира — кнопка входа появляется в личном кабинете и в списке турниров. Рекомендуем зайти в зал заранее и дождаться начала: в жеребьёвку 1-го тура попадут только участники, уже находящиеся в зале. Опоздавшие подключатся и начнут игру со 2-го тура.</p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground/80 flex items-center gap-1.5 mb-1"><Icon name="Clock" size={13} className="text-secondary" /> Ход турнира</h3>
            <p>Как только пара сформирована, участник автоматически переносится на страницу партии. Между турами даётся короткий перерыв — обратный отсчёт до следующего тура виден прямо в зале. При нечётном числе участников один из них в туре получает технический бай (+1 очко без игры).</p>
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