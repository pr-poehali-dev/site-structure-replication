import { useEffect } from 'react';
import func2url from '../../backend/func2url.json';

const URL = func2url['lila-ratings'];
const THROTTLE_MS = 5 * 60 * 1000;
const KEY = 'lila_ratings_sync_at';

export default function LilaRatingsSync() {
  useEffect(() => {
    const last = Number(localStorage.getItem(KEY) || 0);
    if (Date.now() - last < THROTTLE_MS) return;
    localStorage.setItem(KEY, String(Date.now()));
    fetch(URL).catch(() => undefined);
  }, []);

  return null;
}
