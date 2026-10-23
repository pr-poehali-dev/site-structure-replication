import { Link } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

export default function SidebarCards() {
  const { user } = useAuth();
  return (
    <aside className="flex flex-col gap-4">
      <div className="rounded-2xl bg-gradient-to-br from-[#3D7BF7] to-[#2A5FD6] text-white p-5 shadow-sm">
        {user ? (
          <>
            <p className="text-xs uppercase font-semibold opacity-80">Добро пожаловать</p>
            <p className="font-heading font-bold text-xl mt-1 leading-tight">{user.first_name} {user.last_name}</p>
            <div className="mt-4 flex flex-col gap-2">
              <Button asChild className="bg-white text-[#2A5FD6] hover:bg-white/90 font-semibold">
                <Link to="/cabinet"><Icon name="UserRound" size={16} className="mr-2" /> Личный кабинет</Link>
              </Button>
              <Button asChild variant="outline" className="border-white/50 text-white hover:bg-white/10 bg-transparent">
                <Link to="/turnir">Записаться на турнир</Link>
              </Button>
            </div>
          </>
        ) : (
          <>
            <Icon name="Rocket" size={28} />
            <p className="font-heading font-bold text-xl mt-2 leading-tight uppercase">Играй и расти вместе с нами</p>
            <p className="text-sm opacity-90 mt-2">Свой рейтинг, дипломы и бонусы за друзей — после регистрации.</p>
            <div className="mt-4 flex flex-col gap-2">
              <Button asChild className="bg-white text-[#2A5FD6] hover:bg-white/90 font-semibold">
                <Link to="/register"><Icon name="UserPlus" size={16} className="mr-2" /> Зарегистрироваться</Link>
              </Button>
              <Button asChild variant="outline" className="border-white/50 text-white hover:bg-white/10 bg-transparent">
                <Link to="/login">Войти</Link>
              </Button>
            </div>
          </>
        )}
      </div>

      <Link to="/puzzles" className="group rounded-2xl bg-white border border-border p-5 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4">
        <span className="grid place-items-center w-12 h-12 rounded-xl bg-violet-100 text-violet-600 shrink-0">
          <Icon name="Puzzle" size={24} />
        </span>
        <span className="flex-1">
          <span className="block font-heading font-bold uppercase text-primary leading-tight">Шахматные задачи</span>
          <span className="block text-xs text-muted-foreground mt-0.5">Тренируй тактику каждый день</span>
        </span>
        <Icon name="ChevronRight" size={18} className="text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
      </Link>

      <a href="https://vk.com/mirshahmat" target="_blank" rel="noopener noreferrer" className="group rounded-2xl bg-white border border-border p-5 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4">
        <span className="grid place-items-center w-12 h-12 rounded-xl bg-sky-100 text-sky-600 shrink-0">
          <Icon name="Users" size={24} />
        </span>
        <span className="flex-1">
          <span className="block font-heading font-bold uppercase text-primary leading-tight">Мы ВКонтакте</span>
          <span className="block text-xs text-muted-foreground mt-0.5">Расписание и новости турниров</span>
        </span>
        <Icon name="ExternalLink" size={16} className="text-muted-foreground" />
      </a>

      <Link to="/kubki" className="group rounded-2xl bg-white border border-border p-5 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4">
        <span className="grid place-items-center w-12 h-12 rounded-xl bg-rose-100 text-rose-600 shrink-0">
          <Icon name="Award" size={24} />
        </span>
        <span className="flex-1">
          <span className="block font-heading font-bold uppercase text-primary leading-tight">Заказать награды</span>
          <span className="block text-xs text-muted-foreground mt-0.5">Кубки, медали и подарки</span>
        </span>
        <Icon name="ChevronRight" size={18} className="text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </aside>
  );
}
