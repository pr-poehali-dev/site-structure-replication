import { Link, useLocation } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/contexts/AuthContext';
import { useMyApplications } from '@/hooks/useMyApplications';

const DAY_MS = 24 * 60 * 60 * 1000;

const isOver = (a: { results_published?: boolean; date?: string | null }) => {
  if (a.results_published) return true;
  if (!a.date) return false;
  const t = new Date(a.date).getTime();
  return !isNaN(t) && Date.now() - t > 2 * DAY_MS;
};

const HIDDEN_PREFIXES = ['/room/', '/hall/', '/game/', '/admin'];

export default function HallFloatingButton() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const hidden = HIDDEN_PREFIXES.some(p => pathname.startsWith(p));
  return user && !hidden ? <HallButtonInner /> : null;
}

function HallButtonInner() {
  const { apps } = useMyApplications();
  const halls = apps.filter(
    a =>
      a.status === 'paid' &&
      a.hall_open &&
      a.hall_status !== 'finished' &&
      a.tournament_status !== 'archived' &&
      !isOver(a),
  );

  if (!halls.length) return null;

  const target = halls[0];

  return (
    <Link
      to={`/room/${target.tournament_id}`}
      className="fixed bottom-6 right-6 z-50 group max-w-[calc(100vw-3rem)]"
      aria-label="Войти в турнирный зал"
    >
      <span className="absolute inset-0 rounded-full bg-red-600 opacity-60 animate-ping" />
      <span className="relative flex items-center gap-2.5 rounded-full bg-red-600 text-white shadow-xl ring-4 ring-white/80 px-7 py-5 font-heading font-bold text-lg md:text-2xl transition-transform group-hover:scale-105 group-hover:bg-red-700">
        <Icon name="DoorOpen" size={34} />
        <span className="flex flex-col leading-tight text-left">
          <span className="text-sm md:text-base font-medium opacity-90">У вас активный турнир</span>
          <span>Войти в турнирный зал</span>
        </span>
      </span>
    </Link>
  );
}