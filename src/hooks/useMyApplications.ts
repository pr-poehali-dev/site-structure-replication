import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import func2url from '../../backend/func2url.json';

const APPS_URL = func2url['applications'];
const REFRESH_MS = 30000;
const MIN_GAP_MS = 5000;

export interface SharedApplication {
  id: number;
  tournament_id: number;
  tournament_title: string;
  fio: string;
  age: string;
  status: string;
  created_at: string;
  hall_open: boolean;
  tournament_status: string;
  description: string | null;
  date: string | null;
  location: string | null;
  age_category: string | null;
  price: number | null;
  time_control: string | null;
  time_msk: string | null;
  diploma_sample_url: string | null;
  regulation_url: string | null;
  announcement_url: string | null;
  hall_status: string;
  place: number | null;
  lila_ready?: boolean;
  results_published?: boolean;
}

type Listener = (apps: SharedApplication[], loaded: boolean) => void;

let currentToken: string | null = null;
let cache: SharedApplication[] = [];
let loaded = false;
let lastFetchAt = 0;
let inflight: Promise<void> | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach(l => l(cache, loaded));
}

function load(force = false): Promise<void> {
  if (!currentToken) return Promise.resolve();
  if (inflight) return inflight;
  if (!force && Date.now() - lastFetchAt < MIN_GAP_MS) return Promise.resolve();
  const token = currentToken;
  lastFetchAt = Date.now();
  inflight = fetch(`${APPS_URL}?scope=my`, { headers: { 'X-Auth-Token': token } })
    .then(r => (r.ok ? r.json() : { applications: cache }))
    .then(d => {
      if (token !== currentToken) return;
      cache = d.applications || [];
      loaded = true;
      emit();
    })
    .catch(() => {})
    .finally(() => { inflight = null; });
  return inflight;
}

function onVisible() {
  if (document.visibilityState === 'visible') load();
}

function start(token: string) {
  if (currentToken !== token) {
    currentToken = token;
    cache = [];
    loaded = false;
    lastFetchAt = 0;
  }
  load();
  if (!timer) {
    timer = setInterval(() => { if (!document.hidden) load(true); }, REFRESH_MS);
    document.addEventListener('visibilitychange', onVisible);
  }
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    document.removeEventListener('visibilitychange', onVisible);
  }
}

export function useMyApplications() {
  const { token } = useAuth();
  const [state, setState] = useState<{ apps: SharedApplication[]; loaded: boolean }>({ apps: cache, loaded });

  useEffect(() => {
    if (!token) {
      setState({ apps: [], loaded: true });
      return;
    }
    const listener: Listener = (apps, isLoaded) => setState({ apps, loaded: isLoaded });
    listeners.add(listener);
    start(token);
    listener(cache, loaded);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) stop();
    };
  }, [token]);

  const reload = useCallback(() => load(true), []);
  return { apps: state.apps, loading: !state.loaded, reload };
}
