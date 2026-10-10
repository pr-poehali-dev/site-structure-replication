import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/contexts/AuthContext';
import func2url from '../../backend/func2url.json';

const APPS_URL = func2url['applications'];
const REFRESH_MS = 30000;
const HIDDEN_PREFIXES = ['/room/', '/hall/', '/game/', '/admin'];

interface MyApp {
  tournament_id: number;
  tournament_title: string;
  status: string;
  hall_open: boolean;
  hall_status: string;
  tournament_status: string;
}

export default function HallFloatingButton() {
  const { token, user } = useAuth();
  const { pathname } = useLocation();
  const [halls, setHalls] = useState<MyApp[]>([]);

  useEffect(() => {
    if (!token || !user) {
      setHalls([]);
      return;
    }
    let cancelled = false;
    const load = () => {
      if (document.hidden) return;
      fetch(`${APPS_URL}?scope=my`, { headers: { 'X-Auth-Token': token } })
        .then(r => (r.ok ? r.json() : { applications: [] }))
        .then(d => {
          if (cancelled) return;
          const list: MyApp[] = (d.applications || []).filter(
            (a: MyApp) =>
              a.status === 'paid' &&
              a.hall_open &&
              a.hall_status !== 'finished' &&
              a.tournament_status !== 'archived',
          );
          setHalls(list);
        })
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [token, user]);

  if (!halls.length) return null;
  if (HIDDEN_PREFIXES.some(p => pathname.startsWith(p))) return null;

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